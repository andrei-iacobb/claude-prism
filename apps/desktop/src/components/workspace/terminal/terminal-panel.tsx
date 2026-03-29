import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTheme } from "next-themes";
import { useTerminalStore } from "@/stores/terminal-store";
import { useDocumentStore } from "@/stores/document-store";
import { PlusIcon, XIcon, TerminalIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import "@xterm/xterm/css/xterm.css";

interface TerminalOutputEvent {
  terminal_id: string;
  data: string;
}

const LIGHT_THEME = {
  background: "#fafafa",
  foreground: "#1e1e1e",
  cursor: "#1e1e1e",
  cursorAccent: "#fafafa",
  selectionBackground: "#d0d0d0",
  selectionForeground: "#1e1e1e",
  black: "#1e1e1e",
  red: "#cd3131",
  green: "#00bc7c",
  yellow: "#e5a100",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#e5e5e5",
};

const DARK_THEME = {
  background: "#1a1a1a",
  foreground: "#d4d4d4",
  cursor: "#d4d4d4",
  cursorAccent: "#1a1a1a",
  selectionBackground: "#3a3a3a",
  selectionForeground: "#d4d4d4",
  black: "#1e1e1e",
  red: "#f44747",
  green: "#6a9955",
  yellow: "#d7ba7d",
  blue: "#569cd6",
  magenta: "#c586c0",
  cyan: "#4ec9b0",
  white: "#d4d4d4",
  brightBlack: "#808080",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#e5e5e5",
};

const AVAILABLE_SHELLS = [
  { id: "default", label: "Default ($SHELL)" },
  { id: "/opt/homebrew/bin/fish", label: "Fish" },
  { id: "/bin/zsh", label: "Zsh" },
  { id: "/bin/bash", label: "Bash" },
];

function TerminalInstance({ terminalId }: { terminalId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const projectRoot = useDocumentStore((s) => s.projectRoot);
  const { resolvedTheme } = useTheme();
  const shell = useTerminalStore((s) => s.shell);

  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = resolvedTheme === "dark";
    const theme = isDark ? DARK_THEME : LIGHT_THEME;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.35,
      fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      theme,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    // Small delay to let the container size settle before fitting
    requestAnimationFrame(() => fitAddon.fit());

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Spawn the PTY backend
    const cwd = projectRoot ?? ".";
    const shellPath = shell === "default" ? undefined : shell;
    invoke("terminal_spawn", {
      terminalId,
      cwd,
      shell: shellPath,
    }).catch((err) => {
      terminal.writeln(`\r\nFailed to spawn terminal: ${err}`);
    });

    // Listen for output from the PTY
    const unlisten = listen<TerminalOutputEvent>("terminal-output", (event) => {
      if (event.payload.terminal_id === terminalId) {
        terminal.write(event.payload.data);
      }
    });

    // Send user input to the PTY
    const onData = terminal.onData((data) => {
      invoke("terminal_write", { terminalId, data }).catch(() => {});
    });

    // Send resize events to the PTY
    const onResize = terminal.onResize(({ cols, rows }) => {
      invoke("terminal_resize", { terminalId, cols, rows }).catch(() => {});
    });

    // Fit terminal to container on resize
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit());
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      onData.dispose();
      onResize.dispose();
      unlisten.then((fn) => fn());
      terminal.dispose();
      invoke("terminal_kill", { terminalId }).catch(() => {});
    };
  }, [terminalId, projectRoot, resolvedTheme, shell]);

  return <div ref={containerRef} className="h-full w-full px-1 pt-1" />;
}

export function TerminalPanel() {
  const terminals = useTerminalStore((s) => s.terminals);
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);
  const createTerminal = useTerminalStore((s) => s.createTerminal);
  const closeTerminal = useTerminalStore((s) => s.closeTerminal);
  const toggleTerminal = useTerminalStore((s) => s.toggleTerminal);
  const shell = useTerminalStore((s) => s.shell);
  const setShell = useTerminalStore((s) => s.setShell);

  const handleClose = useCallback(
    (id: string) => {
      closeTerminal(id);
    },
    [closeTerminal],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Tab bar */}
      <div className="flex h-9 shrink-0 items-center border-border border-t bg-muted/30 px-2">
        <TerminalIcon className="mr-1.5 size-3.5 text-muted-foreground" />
        {terminals.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTerminal(tab.id)}
            className={`group mr-0.5 flex h-6 items-center gap-1 rounded px-2 text-xs transition-colors ${
              activeTerminalId === tab.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            <span>{tab.title}</span>
            <XIcon
              className="size-3 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                handleClose(tab.id);
              }}
            />
          </button>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="size-6 p-1"
          onClick={() => createTerminal()}
          title="New terminal"
        >
          <PlusIcon className="size-3" />
        </Button>

        <div className="flex-1" />

        {/* Shell selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-muted-foreground text-xs"
            >
              {AVAILABLE_SHELLS.find((s) => s.id === shell)?.label ?? "Shell"}
              <ChevronDownIcon className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {AVAILABLE_SHELLS.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={() => setShell(s.id)}
                className={shell === s.id ? "bg-accent" : ""}
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="ml-1 size-6 p-1"
          onClick={() => toggleTerminal()}
          title="Close panel"
        >
          <XIcon className="size-3" />
        </Button>
      </div>
      {/* Terminal content */}
      <div className="min-h-0 flex-1">
        {terminals.map((tab) => (
          <div
            key={tab.id}
            className={`h-full ${activeTerminalId === tab.id ? "" : "hidden"}`}
          >
            <TerminalInstance terminalId={tab.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
