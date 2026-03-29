import { useEffect, useRef, useState } from "react";

/**
 * Detects which toolbar items overflow a container's visible width.
 * Items must have `data-toolbar-item="<id>"` attributes.
 * Items that don't fully fit are visually hidden (display:none) and their IDs
 * are returned in hiddenIds so the overflow menu can render them.
 */
export function useToolbarOverflow(
  ref: React.RefObject<HTMLElement | null>,
): { hasOverflow: boolean; hiddenIds: Set<string> } {
  const [state, setState] = useState<{
    hasOverflow: boolean;
    hiddenIds: Set<string>;
  }>({ hasOverflow: false, hiddenIds: new Set() });

  const rafId = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const containerRect = el.getBoundingClientRect();
        const items = el.querySelectorAll<HTMLElement>("[data-toolbar-item]");
        const hidden = new Set<string>();

        for (const item of items) {
          // Temporarily make visible so we can measure
          item.style.removeProperty("display");
        }

        for (const item of items) {
          const itemRect = item.getBoundingClientRect();
          const id = item.getAttribute("data-toolbar-item");
          if (!id) continue;

          // Item doesn't fully fit if its right edge exceeds container
          // or left edge is before container
          if (
            itemRect.right > containerRect.right + 1 ||
            itemRect.left < containerRect.left - 1
          ) {
            hidden.add(id);
            item.style.display = "none";
          }
        }

        setState((prev) => {
          if (
            prev.hasOverflow === (hidden.size > 0) &&
            prev.hiddenIds.size === hidden.size &&
            [...hidden].every((id) => prev.hiddenIds.has(id))
          ) {
            return prev;
          }
          return { hasOverflow: hidden.size > 0, hiddenIds: hidden };
        });
      });
    };

    check();

    const resizeObs = new ResizeObserver(check);
    resizeObs.observe(el);

    const mutObs = new MutationObserver(check);
    mutObs.observe(el, { childList: true, subtree: true, attributes: false });

    return () => {
      cancelAnimationFrame(rafId.current);
      resizeObs.disconnect();
      mutObs.disconnect();
      // Restore visibility on cleanup
      const items = el.querySelectorAll<HTMLElement>("[data-toolbar-item]");
      for (const item of items) {
        item.style.removeProperty("display");
      }
    };
  }, [ref]);

  return state;
}
