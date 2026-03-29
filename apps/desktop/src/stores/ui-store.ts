import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ChatViewMode = "drawer" | "split";
export type PanelId = "editor" | "pdf" | "chat";

interface UIState {
  chatViewMode: ChatViewMode;
  chatPanelOpen: boolean;
  /** Order of the main workspace panels (sidebar is always first). */
  panelOrder: PanelId[];
  /** Whether the sidebar is collapsed. */
  sidebarCollapsed: boolean;
  /** Set of currently collapsed panel IDs. */
  collapsedPanels: Set<PanelId>;
  setChatViewMode: (mode: ChatViewMode) => void;
  setChatPanelOpen: (open: boolean) => void;
  toggleChatPanel: () => void;
  setPanelOrder: (order: PanelId[]) => void;
  movePanelLeft: (id: PanelId) => void;
  movePanelRight: (id: PanelId) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  collapsePanel: (id: PanelId) => void;
  expandPanel: (id: PanelId) => void;
  togglePanel: (id: PanelId) => void;
  isPanelCollapsed: (id: PanelId) => boolean;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      chatViewMode: "drawer",
      chatPanelOpen: false,
      panelOrder: ["editor", "pdf", "chat"],
      sidebarCollapsed: false,
      collapsedPanels: new Set<PanelId>(),
      setChatViewMode: (mode) =>
        set({ chatViewMode: mode, chatPanelOpen: mode === "split" }),
      setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
      toggleChatPanel: () => set((s) => ({ chatPanelOpen: !s.chatPanelOpen })),
      setPanelOrder: (order) => set({ panelOrder: order }),
      movePanelLeft: (id) => {
        const order = [...get().panelOrder];
        const idx = order.indexOf(id);
        if (idx > 0) {
          [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
          set({ panelOrder: order });
        }
      },
      movePanelRight: (id) => {
        const order = [...get().panelOrder];
        const idx = order.indexOf(id);
        if (idx >= 0 && idx < order.length - 1) {
          [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
          set({ panelOrder: order });
        }
      },
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      collapsePanel: (id) => {
        const next = new Set(get().collapsedPanels);
        next.add(id);
        set({ collapsedPanels: next });
      },
      expandPanel: (id) => {
        const next = new Set(get().collapsedPanels);
        next.delete(id);
        set({ collapsedPanels: next });
      },
      togglePanel: (id) => {
        const current = get().collapsedPanels;
        const next = new Set(current);
        if (current.has(id)) next.delete(id);
        else next.add(id);
        set({ collapsedPanels: next });
      },
      isPanelCollapsed: (id) => get().collapsedPanels.has(id),
    }),
    {
      name: "claude-prism-ui",
      partialize: (state) => ({
        chatViewMode: state.chatViewMode,
        panelOrder: state.panelOrder,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
