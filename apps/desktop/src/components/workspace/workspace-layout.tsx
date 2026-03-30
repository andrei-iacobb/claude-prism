import {
  type ReactNode,
  Fragment,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import { Sidebar } from "./sidebar";
import { LatexEditor } from "./editor/latex-editor";
import { PdfPreview } from "./preview/pdf-preview";
import { ClaudeChatPanel } from "@/components/claude-chat/claude-chat-panel";
import { TerminalPanel } from "./terminal/terminal-panel";
import { useDocumentStore } from "@/stores/document-store";
import { useUIStore, type PanelId } from "@/stores/ui-store";
import { useTerminalStore } from "@/stores/terminal-store";
import {
  FileTextIcon,
  EyeIcon,
  BotMessageSquareIcon,
  PanelLeftIcon,
} from "lucide-react";

const PANEL_CONFIG: Record<
  PanelId,
  {
    component: () => ReactNode;
    defaultSize: number;
    defaultSizeSplit: number;
    minSize: number;
    maxSize?: number;
  }
> = {
  editor: {
    component: () => <LatexEditor />,
    defaultSize: 42.5,
    defaultSizeSplit: 35,
    minSize: 20,
  },
  pdf: {
    component: () => <PdfPreview />,
    defaultSize: 42.5,
    defaultSizeSplit: 25,
    minSize: 20,
  },
  chat: {
    component: () => <ClaudeChatPanel />,
    defaultSize: 25,
    defaultSizeSplit: 25,
    minSize: 15,
    maxSize: 50,
  },
};

/**
 * Registry so any component can imperatively collapse/expand panels.
 * Keys are "sidebar" | PanelId.
 */
const panelRefs = new Map<string, ImperativePanelHandle>();

export function getPanelRef(id: string) {
  return panelRefs.get(id) ?? null;
}

export function registerPanelRef(
  id: string,
  ref: ImperativePanelHandle | null,
) {
  if (ref) panelRefs.set(id, ref);
  else panelRefs.delete(id);
}

export function WorkspaceLayout() {
  const initialized = useDocumentStore((s) => s.initialized);
  const chatViewMode = useUIStore((s) => s.chatViewMode);
  const panelOrder = useUIStore((s) => s.panelOrder);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const collapsePanel = useUIStore((s) => s.collapsePanel);
  const expandPanel = useUIStore((s) => s.expandPanel);

  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const [recovering, setRecovering] = useState(false);

  // Register sidebar ref
  useEffect(() => {
    registerPanelRef("sidebar", sidebarRef.current);
    return () => registerPanelRef("sidebar", null);
  }, []);

  // Sync sidebar collapsed state with panel API
  useEffect(() => {
    const panel = sidebarRef.current;
    if (!panel) return;
    if (sidebarCollapsed) panel.collapse();
    else panel.expand();
  }, [sidebarCollapsed]);

  // Recover from HMR store resets: if projectRoot is set but initialized is false,
  // re-open the project so we don't get stuck on "Loading project..."
  useEffect(() => {
    if (initialized || recovering) return;
    const { projectRoot, openProject } = useDocumentStore.getState();
    if (projectRoot) {
      setRecovering(true);
      openProject(projectRoot).finally(() => setRecovering(false));
    }
  }, [initialized, recovering]);

  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  const isSplit = chatViewMode === "split";
  const terminalOpen = useTerminalStore((s) => s.isOpen);

  // Filter out chat panel when not in split mode
  const visiblePanels = isSplit
    ? panelOrder
    : panelOrder.filter((id) => id !== "chat");

  return (
    <PanelGroup direction="vertical" className="h-full">
      {/* Main workspace (horizontal panels) */}
      <Panel defaultSize={terminalOpen ? 70 : 100} minSize={30}>
        <div className="relative h-full">
          <CollapsedPanelRestoreBar />
          <PanelGroup
            direction="horizontal"
            className="h-full"
            // Force re-mount when panel order changes so defaultSize values apply
            key={visiblePanels.join("-")}
          >
            {/* Sidebar — collapsible */}
            <Panel
              ref={sidebarRef}
              defaultSize={sidebarCollapsed ? 0 : 15}
              minSize={10}
              maxSize={25}
              collapsible
              collapsedSize={0}
              onCollapse={() => setSidebarCollapsed(true)}
              onExpand={() => setSidebarCollapsed(false)}
            >
              <Sidebar />
            </Panel>

            {visiblePanels.map((panelId) => {
              const config = PANEL_CONFIG[panelId];
              return (
                <Fragment key={panelId}>
                  <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-ring" />
                  <CollapsiblePanel
                    panelId={panelId}
                    defaultSize={
                      isSplit ? config.defaultSizeSplit : config.defaultSize
                    }
                    minSize={config.minSize}
                    maxSize={config.maxSize}
                    onCollapse={() => collapsePanel(panelId)}
                    onExpand={() => expandPanel(panelId)}
                  >
                    {config.component()}
                  </CollapsiblePanel>
                </Fragment>
              );
            })}
          </PanelGroup>
        </div>
      </Panel>

      {/* Terminal panel — below workspace */}
      {terminalOpen && (
        <>
          <PanelResizeHandle className="h-px bg-border transition-colors hover:bg-ring" />
          <Panel defaultSize={30} minSize={10} maxSize={60}>
            <TerminalPanel />
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}

const PANEL_ICONS: Record<string, typeof FileTextIcon> = {
  sidebar: PanelLeftIcon,
  editor: FileTextIcon,
  pdf: EyeIcon,
  chat: BotMessageSquareIcon,
};

const PANEL_NAMES: Record<string, string> = {
  sidebar: "Sidebar",
  editor: "Editor",
  pdf: "Preview",
  chat: "Claude",
};

/** Floating bar that shows restore buttons when panels are collapsed. */
function CollapsedPanelRestoreBar() {
  const collapsedPanels = useUIStore((s) => s.collapsedPanels);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const chatViewMode = useUIStore((s) => s.chatViewMode);

  const items: string[] = [];
  if (sidebarCollapsed) items.push("sidebar");
  for (const id of collapsedPanels) {
    if (id === "chat" && chatViewMode !== "split") continue;
    items.push(id);
  }

  if (items.length === 0) return null;

  return (
    <div className="absolute right-2 bottom-2 z-50 flex items-center gap-1 rounded-lg border border-border bg-background/95 px-2 py-1.5 shadow-md backdrop-blur-sm">
      <span className="mr-1 text-muted-foreground text-xs">Restore:</span>
      {items.map((id) => {
        const Icon = PANEL_ICONS[id] ?? FileTextIcon;
        const name = PANEL_NAMES[id] ?? id;
        return (
          <button
            key={id}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              if (id === "sidebar") {
                useUIStore.getState().toggleSidebar();
              } else {
                const ref = getPanelRef(id);
                if (ref) ref.expand();
              }
            }}
            title={`Restore ${name}`}
          >
            <Icon className="size-3.5" />
            {name}
          </button>
        );
      })}
    </div>
  );
}

/** Wrapper that registers the panel ref and enables collapse. */
function CollapsiblePanel({
  panelId,
  defaultSize,
  minSize,
  maxSize,
  onCollapse,
  onExpand,
  children,
}: {
  panelId: PanelId;
  defaultSize: number;
  minSize: number;
  maxSize?: number;
  onCollapse: () => void;
  onExpand: () => void;
  children: ReactNode;
}) {
  const ref = useRef<ImperativePanelHandle>(null);

  useEffect(() => {
    registerPanelRef(panelId, ref.current);
    return () => registerPanelRef(panelId, null);
  }, [panelId]);

  return (
    <Panel
      ref={ref}
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      collapsible
      collapsedSize={0}
      onCollapse={onCollapse}
      onExpand={onExpand}
    >
      {children}
    </Panel>
  );
}
