import { EyeIcon } from "lucide-react";
import { useDocumentStore } from "@/stores/document-store";
import { MarkdownRenderer } from "@/components/claude-chat/markdown-renderer";
import { PanelMoveControls } from "@/components/workspace/panel-move-controls";

export function MarkdownPreview() {
  const content = useDocumentStore((s) => {
    const file = s.files.find((f) => f.id === s.activeFileId);
    return file?.content ?? "";
  });

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-[calc(36px+var(--titlebar-height))] shrink-0 items-center border-border border-b bg-muted/30 px-3 pt-[var(--titlebar-height)]">
        <EyeIcon className="mr-1.5 size-4 text-muted-foreground" />
        <span className="font-medium text-muted-foreground text-sm">
          Preview
        </span>
        <div className="flex-1" />
        <PanelMoveControls panelId="pdf" />
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <MarkdownRenderer
          content={content}
          className="prose prose-sm dark:prose-invert max-w-none"
        />
      </div>
    </div>
  );
}
