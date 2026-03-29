# Typst Integration Plan for ClaudePrism

## Overview

Add Typst as a second compilation engine alongside LaTeX, giving users instant live preview (<100ms) while maintaining full LaTeX compatibility for journal submissions.

---

## Why Typst

| | LaTeX | Typst |
|---|---|---|
| Compile speed | 2-10s (batch, multi-pass) | <100ms (incremental) |
| Syntax | `\textbf{bold}` `\begin{enumerate}` | `*bold*` `+ item` |
| Error messages | Cryptic (`! Undefined control sequence`) | Human-readable with line/col |
| Package ecosystem | 6000+ on CTAN | ~500 on Typst Universe (growing) |
| Journal acceptance | Universal | Almost none yet |
| Math | Gold standard | Very good, ~95% compatible |
| Binary size | Tectonic ~30MB + bundles | Typst CLI ~15MB standalone |
| Incremental compilation | No | Yes (only changed pages re-render) |

**Key insight:** Students use LaTeX because professors/journals require it. The ideal workflow: write fast in Typst → export to LaTeX when submitting.

---

## Current LaTeX Coupling Audit

The codebase has **6,500+ lines** of LaTeX-specific code across **16 layers**:

### High Severity (core rewrites needed)

| Area | File | Lines | What's Coupled |
|------|------|-------|----------------|
| Tectonic compiler | `src-tauri/src/latex.rs` | 1,255 | Entire Tectonic API, subprocess isolation, SyncTeX, error parsing, build dir management |
| Template registry | `src/lib/template-registry.ts` | 3,200 | 14 templates with full LaTeX preambles, `\documentclass`, `\usepackage`, `\begin{document}` |

### Medium Severity (remap/extend)

| Area | File | Lines | What's Coupled |
|------|------|-------|----------------|
| Editor keybinds | `latex-editor.tsx` | ~50 | Mod-b → `\textbf{}`, Mod-i → `\textit{}`, `wrapSelection()` |
| Sidebar ToC parser | `sidebar.tsx` | ~30 | Regex: `\\(section\|subsection\|chapter)...` |
| File type system | `lib/tauri/fs.ts` | ~120 | `ProjectFileType` enum, `.tex`/`.ltx` detection, LaTeX artifact ignore list |
| Compile target resolution | `document-store.ts` | ~60 | `resolveTexRoot()` parses `% !TEX root = <file>` magic comment |
| Error parser | `latex.rs` | ~30 | Extracts errors from Tectonic logs (lines starting with `!`) |
| SyncTeX source mapping | `latex.rs` + `pdf-preview.tsx` | ~200 | Bidirectional PDF↔source mapping via SyncTeX format |
| Editor toolbar | `editor-toolbar.tsx` | ~20 | Bold/Italic/Code buttons insert `\textbf{}` etc |

### Low Severity (config/text changes)

| Area | File | Lines | What's Coupled |
|------|------|-------|----------------|
| Default CLAUDE.md | `lib/default-claude-md.ts` | 65 | All LaTeX-specific instructions |
| System prompt | `src-tauri/src/claude.rs` | ~20 | Rules about `\cite`, `\section`, BibTeX |
| History .gitignore | `src-tauri/src/history.rs` | ~20 | Ignores `.aux`, `.log`, `.toc`, `.synctex.gz`, etc |
| New file skeleton | `document-store.ts` | ~5 | `\documentclass{article}\begin{document}...\end{document}` |
| CodeMirror syntax | `latex-editor.tsx` | ~5 | `import { latex } from "codemirror-lang-latex"` |
| Zotero → BibTeX | `zotero-store.ts` | ~50 | Exports BibTeX format (Typst uses BibTeX too, so mostly fine) |
| Build artifact filters | `fs.ts` + `history.rs` | ~60 | `.aux`, `.fls`, `.fdb_latexmk` etc |

---

## Translation Tools (Offline, No API)

### Recommended: Tylax (best fit for this project)

- **URL:** https://github.com/scipenai/tylax
- **Direction:** Bidirectional (LaTeX ↔ Typst)
- **Language:** Rust + WASM
- **Coverage:** Full documents — math, tables (multicolumn/multirow/booktabs), bibliographies, sections/chapters/lists, experimental TikZ→CeTZ
- **License:** Apache-2.0
- **Why it's perfect:** Rust native (compiles directly into the Tauri binary), bidirectional, good coverage, permissive license
- **Handles ~85% of conversions** — Claude fallback only for exotic packages/macros

### Other Tools

| Tool | Direction | Type | Coverage | License | Notes |
|------|-----------|------|----------|---------|-------|
| **MiTeX** | LaTeX→Typst | Rust/WASM | Math only | Apache-2.0 | Blazing fast (0.085s for 32.5k equations), tiny (185KB). Use for embedding LaTeX math in Typst |
| **tex2typst** | Both | JavaScript | Math only | Apache-2.0 | `npm install tex2typst`, lightweight |
| **Pandoc** | Both | Haskell CLI | Full docs | GPL-2.0 | Typst reader since 3.1.3, writer since 3.1.2. Heavy (~100MB binary). Good fallback |
| **tex2typst-rs** | LaTeX→Typst | Rust | Math | GPL-3.0 | ⚠️ GPL license restricts bundling |
| **tex-to-typst** | LaTeX→Typst | JavaScript | Partial math | MIT | Alpha quality, not recommended |

### Translation Strategy

```
User clicks "Convert to Typst"
         ↓
    Tylax (Rust, bundled)
    Handles: math, tables, sections, lists, bibliography
         ↓
    Success? → Done (~85% of documents)
         ↓
    Failures/warnings? → Show diff + offer Claude fixup
    Claude only touches the broken parts (saves tokens)
```

---

## Implementation Phases

### Phase 1: Typst Compiler (2-3 days)

**Goal:** `.typ` files compile to PDF and display in preview.

- [ ] Add `typst` Rust crate to `Cargo.toml` (or shell out to `typst` CLI)
- [ ] Create `compile_typst()` in a new `typst.rs` module
- [ ] Add `"typst"` to `ProjectFileType` in `fs.ts`
- [ ] Add `.typ` extension detection in `getFileType()`
- [ ] Update `resolveCompileTarget()` to handle `.typ` files
- [ ] Route compilation: `.tex` → Tectonic, `.typ` → Typst
- [ ] Update `computeSourceHash()` to include `.typ` files
- [ ] Test: create a `.typ` file, hit compile, see PDF

### Phase 2: Editor Polish (1-2 days)

**Goal:** `.typ` files have proper syntax highlighting and editing support.

- [ ] Add `codemirror-lang-typst` package (exists on npm)
- [ ] Update language mode selection: `.typ` → Typst highlighter
- [ ] Add Typst keybinds: Mod-b → `*bold*`, Mod-i → `_italic_`
- [ ] Update editor toolbar buttons for Typst formatting
- [ ] Add Typst ToC parser: regex for `= Heading`, `== Subheading`
- [ ] Update error parsing for Typst error format
- [ ] Add Typst-specific diagnostics/linting if available

### Phase 3: Templates (2-3 days)

**Goal:** Users can create Typst projects from templates.

- [ ] Add `language: "latex" | "typst"` field to `TemplateDefinition`
- [ ] Add language picker to project wizard (radio: LaTeX / Typst)
- [ ] Port all 14 templates to Typst equivalents
- [ ] Update `getTemplateSkeleton()` to handle both languages
- [ ] Update new file skeleton for `.typ` files
- [ ] Update default CLAUDE.md for Typst projects

### Phase 4: Translation Layer (2-3 days)

**Goal:** Convert existing LaTeX documents to Typst and vice versa.

- [ ] Bundle Tylax as a Rust dependency (or WASM module)
- [ ] Create `convert_latex_to_typst()` and `convert_typst_to_latex()` Tauri commands
- [ ] Add UI: "Convert Project to Typst" / "Convert Project to LaTeX" in project menu
- [ ] Add slash commands: `/convert-to-typst`, `/convert-to-latex`
- [ ] Show conversion diff before applying
- [ ] Claude fallback: for files that Tylax can't fully convert, offer "Fix with Claude" (only sends the broken parts)
- [ ] Add "Convert Selection" action in SelectionToast

### Phase 5: Claude Integration (1 day)

**Goal:** Claude understands Typst syntax and can help write/edit Typst documents.

- [ ] Add Typst rules to system prompt in `claude.rs`
- [ ] Create Typst-specific `DEFAULT_TYPST_MD` for `.claude/claude.md`
- [ ] Auto-detect project language and use appropriate prompt
- [ ] Update Zotero integration: Typst uses `@bibliography("refs.bib")` syntax
- [ ] Update skills system prompt to mention Typst when relevant

### Phase 6: Source Mapping (1-2 days)

**Goal:** Click in PDF → jump to source in `.typ` file (and vice versa).

- [ ] Investigate Typst's source mapping output format
- [ ] Implement Typst source mapping parser (equivalent to SyncTeX)
- [ ] Wire up bidirectional click-to-source in PDF preview
- [ ] Update double-click-to-navigate in PDF viewer

---

## Technical Notes

### Typst Rust Crate

The `typst` crate can be used as a library (no subprocess needed, unlike Tectonic):

```rust
// Much simpler than Tectonic — single function call
let pdf_bytes = typst::compile(&source, &world)?;
```

Key advantages over Tectonic:
- No subprocess isolation needed (no C-level global state issues)
- Incremental compilation support
- Much faster cold start
- Smaller binary footprint

### File Type Detection

```typescript
// Current
export type ProjectFileType = "tex" | "image" | "pdf" | "bib" | "style" | "other";

// New
export type ProjectFileType = "tex" | "typst" | "image" | "pdf" | "bib" | "style" | "other";
```

### Compile Routing

```typescript
// In latex-compiler.ts
export async function compileDocument(projectDir: string, mainFile: string): Promise<Uint8Array> {
  if (mainFile.endsWith(".typ")) {
    return invoke<ArrayBuffer>("compile_typst", { projectDir, mainFile });
  }
  return invoke<ArrayBuffer>("compile_latex", { projectDir, mainFile });
}
```

### Typst Build Artifacts

Typst produces fewer artifacts than LaTeX:
- No `.aux`, `.toc`, `.lof`, `.lot`, `.fls`, `.fdb_latexmk`
- Only `.pdf` output + optional `.log`
- No SyncTeX file (different source mapping mechanism)

### Keyboard Shortcuts Mapping

| Action | LaTeX | Typst |
|--------|-------|-------|
| Bold | `\textbf{text}` | `*text*` |
| Italic | `\textit{text}` | `_text_` |
| Code | `\texttt{text}` | `` `text` `` |
| Heading | `\section{Title}` | `= Title` |
| Subheading | `\subsection{Title}` | `== Title` |
| Citation | `\cite{key}` | `@key` |
| Reference | `\ref{label}` | `@label` |
| Math inline | `$E=mc^2$` | `$E=m c^2$` |
| Math block | `\begin{equation}...\end{equation}` | `$ ... $` (on own line) |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Typst crate adds significant binary size | Typst is ~4MB compiled; acceptable |
| Tylax doesn't handle edge cases | Claude fallback for remaining ~15% |
| Students confused by two languages | Clear language picker, good defaults, conversion tools |
| Typst API changes (young project) | Pin crate version, test on updates |
| Source mapping differences | May need to implement custom solution |
| Journal requires specific LaTeX class | Keep full LaTeX support, offer Typst→LaTeX export |

---

## Success Metrics

- [ ] Typst compilation <200ms for typical documents
- [ ] LaTeX→Typst conversion via Tylax covers >80% of test documents without Claude
- [ ] All 14 templates available in both languages
- [ ] Zero regressions in existing LaTeX workflow
- [ ] Source mapping works for Typst (click PDF → jump to .typ)
