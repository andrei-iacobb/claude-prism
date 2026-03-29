import { create } from "zustand";

interface TerminalTab {
  id: string;
  title: string;
}

interface TerminalState {
  isOpen: boolean;
  terminals: TerminalTab[];
  activeTerminalId: string | null;
  shell: string;
  toggleTerminal: () => void;
  openTerminal: () => void;
  closeTerminal: (id: string) => void;
  createTerminal: () => string;
  setActiveTerminal: (id: string) => void;
  setShell: (shell: string) => void;
}

let counter = 0;

export const useTerminalStore = create<TerminalState>((set, get) => ({
  isOpen: false,
  terminals: [],
  activeTerminalId: null,
  shell: "default",

  toggleTerminal: () => {
    const state = get();
    if (state.isOpen) {
      set({ isOpen: false });
    } else {
      if (state.terminals.length === 0) {
        const id = get().createTerminal();
        set({ isOpen: true, activeTerminalId: id });
      } else {
        set({ isOpen: true });
      }
    }
  },

  openTerminal: () => {
    const state = get();
    if (state.terminals.length === 0) {
      const id = get().createTerminal();
      set({ isOpen: true, activeTerminalId: id });
    } else {
      set({ isOpen: true });
    }
  },

  createTerminal: () => {
    counter++;
    const id = `terminal-${counter}`;
    const tab: TerminalTab = { id, title: `Terminal ${counter}` };
    set((s) => ({
      terminals: [...s.terminals, tab],
      activeTerminalId: id,
    }));
    return id;
  },

  closeTerminal: (id: string) => {
    set((s) => {
      const remaining = s.terminals.filter((t) => t.id !== id);
      const needNewActive = s.activeTerminalId === id;
      return {
        terminals: remaining,
        activeTerminalId: needNewActive
          ? (remaining[remaining.length - 1]?.id ?? null)
          : s.activeTerminalId,
        isOpen: remaining.length > 0 ? s.isOpen : false,
      };
    });
  },

  setActiveTerminal: (id: string) => set({ activeTerminalId: id }),

  setShell: (shell: string) => set({ shell }),
}));
