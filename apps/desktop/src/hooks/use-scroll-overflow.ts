import { useCallback, useEffect, useRef, useState } from "react";

interface ScrollOverflowState {
  canScrollUp: boolean;
  canScrollDown: boolean;
  hiddenAbove: number;
  hiddenBelow: number;
  scrollUp: () => void;
  scrollDown: () => void;
}

export function useScrollOverflow(
  containerRef: React.RefObject<HTMLElement | null>,
): ScrollOverflowState {
  const [state, setState] = useState({
    canScrollUp: false,
    canScrollDown: false,
    hiddenAbove: 0,
    hiddenBelow: 0,
  });

  const rafId = useRef(0);

  const calculate = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;

      const canScrollUp = el.scrollTop > 0;
      const canScrollDown =
        el.scrollTop + el.clientHeight < el.scrollHeight - 1;

      const items = el.querySelectorAll("[data-sidebar-item]");
      const rect = el.getBoundingClientRect();
      let hiddenAbove = 0;
      let hiddenBelow = 0;

      for (const item of items) {
        const itemRect = item.getBoundingClientRect();
        if (itemRect.bottom <= rect.top) {
          hiddenAbove++;
        } else if (itemRect.top >= rect.bottom) {
          hiddenBelow++;
        }
      }

      setState((prev) => {
        if (
          prev.canScrollUp === canScrollUp &&
          prev.canScrollDown === canScrollDown &&
          prev.hiddenAbove === hiddenAbove &&
          prev.hiddenBelow === hiddenBelow
        ) {
          return prev;
        }
        return { canScrollUp, canScrollDown, hiddenAbove, hiddenBelow };
      });
    });
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Initial calculation
    calculate();

    // Scroll listener
    el.addEventListener("scroll", calculate, { passive: true });

    // ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(calculate);
    resizeObserver.observe(el);

    // MutationObserver for child additions/removals
    const mutationObserver = new MutationObserver(calculate);
    mutationObserver.observe(el, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(rafId.current);
      el.removeEventListener("scroll", calculate);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [containerRef, calculate]);

  const scrollUp = useCallback(() => {
    containerRef.current?.scrollBy({ top: -100, behavior: "smooth" });
  }, [containerRef]);

  const scrollDown = useCallback(() => {
    containerRef.current?.scrollBy({ top: 100, behavior: "smooth" });
  }, [containerRef]);

  return { ...state, scrollUp, scrollDown };
}
