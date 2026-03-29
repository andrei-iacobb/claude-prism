type FitMode = "fit-width" | "fit-height" | null;

/** Per-root zoom state cache: rootFileId → { scale, fitMode } */
export const zoomCache = new Map<string, { scale: number; fitMode: FitMode }>();

/** Clear zoom cache (e.g., on project close). */
export function clearZoomCache(): void {
  zoomCache.clear();
}
