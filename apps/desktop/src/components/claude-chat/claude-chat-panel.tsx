import { XIcon } from "lucide-react";
import { useClaudeChatStore } from "@/stores/claude-chat-store";
import { useClaudeEvents } from "@/hooks/use-claude-events";
import { useUIStore } from "@/stores/ui-store";
import { PanelMoveControls } from "@/components/workspace/panel-move-controls";
import { ChatMessages } from "./chat-messages";
import { ChatComposer } from "./chat-composer";
import { ChatTabBar } from "./chat-tab-bar";

export function ClaudeChatPanel() {
  useClaudeEvents();

  const error = useClaudeChatStore((s) => s.error);
  const setChatViewMode = useUIStore((s) => s.setChatViewMode);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="scrollbar-none flex h-[calc(36px+var(--titlebar-height))] items-center justify-between overflow-x-auto border-border border-b px-2 pt-[var(--titlebar-height)]">
        <div className="flex items-center gap-1">
          <span className="px-1 font-medium text-foreground text-xs">
            Claude
          </span>
          <PanelMoveControls panelId="chat" />
        </div>
        <button
          type="button"
          onClick={() => setChatViewMode("drawer")}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close panel"
          title="Close"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Tab bar */}
      <ChatTabBar />

      {/* Error banner */}
      {error && (
        <div className="mx-3 mb-1 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-destructive text-xs">
          {error}
        </div>
      )}

      {/* Messages area */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ChatMessages />
      </div>

      {/* Composer */}
      <ChatComposer isOpen={true} />
    </div>
  );
}
