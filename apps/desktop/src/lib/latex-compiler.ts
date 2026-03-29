import { invoke } from "@tauri-apps/api/core";
import { readFile, writeFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { resolveTexRoot, type ProjectFile } from "@/stores/document-store";
import { createLogger } from "@/lib/debug/logger";

const log = createLogger("latex");

/** Resolve which file to compile and the root ID for caching.
 *  Returns `null` when the project has no compilable .tex file. */
export function resolveCompileTarget(
  activeFileId: string,
  files: ProjectFile[],
): { rootId: string; targetPath: string } | null {
  const rootId = resolveTexRoot(activeFileId, files);
  const rootEntry = files.find((f) => f.id === rootId);
  if (rootEntry?.type === "tex") {
    return { rootId, targetPath: rootEntry.relativePath };
  }
  // Fallback: look for any well-known root tex file
  const fallback = files.find(
    (f) => f.name === "main.tex" || f.name === "document.tex",
  );
  if (fallback) {
    return { rootId: fallback.id, targetPath: fallback.relativePath };
  }
  // Final fallback: use the first available .tex file in the project
  const anyTex = files.find((f) => f.type === "tex");
  if (anyTex) {
    return { rootId: anyTex.id, targetPath: anyTex.relativePath };
  }
  // No .tex file exists — cannot compile
  return null;
}

/** Extract a human-readable error message from an unknown catch value. */
export function formatCompileError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "Compilation failed";
}

export async function compileLatex(
  projectDir: string,
  mainFile: string = "main.tex",
): Promise<Uint8Array> {
  log.info(`Compiling ${mainFile}`);
  const start = performance.now();
  // compile_latex returns raw PDF bytes via Tauri IPC Response
  const buffer = await invoke<ArrayBuffer>("compile_latex", {
    projectDir,
    mainFile,
  });

  const result = new Uint8Array(buffer);
  log.info(
    `Compiled ${mainFile} in ${(performance.now() - start).toFixed(0)}ms (${(result.byteLength / 1024).toFixed(0)} KB)`,
  );
  return result;
}

// ── Disk PDF Cache ──
// Saves compiled PDFs to .prism/build/<name>.pdf alongside the Tectonic artifacts.
// On project open, we try to load cached PDF first — only recompile if content changed.

/** Compute a simple hash of all .tex/.bib source file contents for change detection. */
export function computeSourceHash(files: ProjectFile[]): string {
  const sourceFiles = files
    .filter((f) => (f.type === "tex" || f.name.endsWith(".bib")) && f.content)
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  // Simple djb2 hash of concatenated contents
  let hash = 5381;
  for (const file of sourceFiles) {
    const content = file.content ?? "";
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
    }
  }
  return (hash >>> 0).toString(36);
}

/** Path to the cached PDF in the .prism/build/ directory. */
async function cachedPdfPath(
  projectDir: string,
  mainFile: string,
): Promise<string> {
  const baseName = mainFile.replace(/\.tex$/, "");
  return join(projectDir, ".prism", "build", `${baseName}.pdf`);
}

/** Path to the source hash file stored alongside the cached PDF. */
async function cachedHashPath(projectDir: string): Promise<string> {
  return join(projectDir, ".prism", "build", ".source-hash");
}

/**
 * Try to load a previously compiled PDF from disk cache.
 * Returns the PDF bytes if the cache exists AND the source hash matches,
 * otherwise returns null (meaning we need to recompile).
 */
export async function loadCachedPdf(
  projectDir: string,
  mainFile: string,
  currentHash: string,
): Promise<Uint8Array | null> {
  try {
    const hashFile = await cachedHashPath(projectDir);
    if (!(await exists(hashFile))) return null;

    const storedHash = new TextDecoder().decode(await readFile(hashFile)).trim();
    if (storedHash !== currentHash) {
      log.debug(
        `Cache miss: hash changed (${storedHash} → ${currentHash})`,
      );
      return null;
    }

    const pdfPath = await cachedPdfPath(projectDir, mainFile);
    if (!(await exists(pdfPath))) return null;

    const data = await readFile(pdfPath);
    log.info(
      `Loaded cached PDF (${(data.byteLength / 1024).toFixed(0)} KB)`,
    );
    return new Uint8Array(data);
  } catch (err) {
    log.debug("Cache load failed", { error: String(err) });
    return null;
  }
}

/**
 * Save the source hash to disk after a successful compilation.
 * The PDF itself is already written by Tectonic to .prism/build/.
 */
export async function saveCacheHash(
  projectDir: string,
  hash: string,
): Promise<void> {
  try {
    const hashFile = await cachedHashPath(projectDir);
    const buildDir = await join(projectDir, ".prism", "build");
    if (!(await exists(buildDir))) {
      await mkdir(buildDir, { recursive: true });
    }
    await writeFile(hashFile, new TextEncoder().encode(hash));
  } catch (err) {
    log.debug("Cache hash save failed", { error: String(err) });
  }
}

export interface SynctexResult {
  file: string;
  line: number;
  column: number;
}

export async function synctexEdit(
  projectDir: string,
  page: number,
  x: number,
  y: number,
): Promise<SynctexResult | null> {
  try {
    const result = await invoke<SynctexResult>("synctex_edit", {
      projectDir,
      page,
      x,
      y,
    });
    if (result)
      log.debug(`SyncTeX: page ${page} → ${result.file}:${result.line}`);
    return result;
  } catch (err) {
    log.debug("SyncTeX lookup failed", { page, error: String(err) });
    return null;
  }
}
