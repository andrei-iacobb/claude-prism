import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  Heading1Icon,
  Heading2Icon,
  CodeIcon,
  CropIcon,
  FunctionSquareIcon,
  FileTextIcon,
  ImageIcon,
  MinusIcon,
  PlusIcon,
  BookMarkedIcon,
  ExternalLinkIcon,
  PanelRightIcon,
  PanelLeftIcon,
  MessageCircleIcon,
  EyeIcon,
  BotMessageSquareIcon,
  MoreHorizontalIcon,
  LinkIcon,
  QuoteIcon,
  FunctionSquareIcon as MdMathIcon,
} from "lucide-react";
import { useToolbarOverflow } from "@/hooks/use-toolbar-overflow";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentStore } from "@/stores/document-store";
import { useUIStore, type PanelId } from "@/stores/ui-store";
import { PanelMoveControls } from "@/components/workspace/panel-move-controls";
import { getPanelRef } from "@/components/workspace/workspace-layout";

interface EditorInfo {
  id: string;
  name: string;
}

const ZOOM_OPTIONS = [
  { value: "0.5", label: "50%" },
  { value: "0.75", label: "75%" },
  { value: "1", label: "100%" },
  { value: "1.25", label: "125%" },
  { value: "1.5", label: "150%" },
  { value: "2", label: "200%" },
  { value: "3", label: "300%" },
  { value: "4", label: "400%" },
];

interface EditorToolbarProps {
  editorView: RefObject<EditorView | null>;
  fileType?: "tex" | "image" | "md";
  imageScale?: number;
  onImageScaleChange?: (scale: number) => void;
  cropMode?: boolean;
  onCropToggle?: () => void;
}

export function EditorToolbar({
  editorView,
  fileType = "tex",
  imageScale = 1,
  onImageScaleChange,
  cropMode,
  onCropToggle,
}: EditorToolbarProps) {
  const fileName = useDocumentStore((s) => {
    const activeFile = s.files.find((f) => f.id === s.activeFileId);
    return activeFile?.name ?? "main.tex";
  });
  const activeFilePath = useDocumentStore((s) => {
    const activeFile = s.files.find((f) => f.id === s.activeFileId);
    return activeFile?.relativePath;
  });
  const projectRoot = useDocumentStore((s) => s.projectRoot);
  const toolbarItemsRef = useRef<HTMLDivElement>(null);
  const { hasOverflow: toolbarOverflow, hiddenIds } =
    useToolbarOverflow(toolbarItemsRef);

  const [editors, setEditors] = useState<EditorInfo[]>([]);

  useEffect(() => {
    invoke<EditorInfo[]>("detect_editors")
      .then(setEditors)
      .catch(() => {});
  }, []);

  const openInEditor = useCallback(
    (editorId: string) => {
      if (!projectRoot) return;
      const view = editorView.current;
      const line = view
        ? view.state.doc.lineAt(view.state.selection.main.head).number
        : undefined;
      invoke("open_in_editor", {
        editorId,
        projectPath: projectRoot,
        filePath: activeFilePath,
        line,
      }).catch((err) => console.error("open_in_editor failed:", err));
    },
    [projectRoot, activeFilePath, editorView],
  );

  const insertText = (before: string, after: string = "") => {
    const view = editorView.current;
    if (!view) return;

    const { from, to } = view.state.selection.main;
    const selectedText = view.state.sliceDoc(from, to);

    view.dispatch({
      changes: {
        from,
        to,
        insert: before + selectedText + after,
      },
      selection: {
        anchor: from + before.length,
        head: from + before.length + selectedText.length,
      },
    });
    view.focus();
  };

  const wrapSelection = (wrapper: string) => {
    insertText(wrapper, wrapper);
  };

  const zoomIn = () => onImageScaleChange?.(Math.min(4, imageScale + 0.25));
  const zoomOut = () => onImageScaleChange?.(Math.max(0.25, imageScale - 0.25));

  if (fileType === "image") {
    return (
      <div className="flex h-[calc(36px+var(--titlebar-height))] items-center border-border border-b bg-muted/30 pt-[var(--titlebar-height)]">
        <div className="flex shrink-0 items-center gap-1 px-2">
          <SidebarToggle />
          <CollapsedPanelButtons />
          <ImageIcon className="size-4 text-muted-foreground" />
          <span className="font-medium text-muted-foreground text-sm">
            {fileName}
          </span>
        </div>
        <div className="scrollbar-none flex min-w-0 flex-1 items-center justify-end gap-0.5 overflow-x-auto px-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={zoomOut}
            disabled={imageScale <= 0.25}
          >
            <MinusIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={zoomIn}
            disabled={imageScale >= 4}
          >
            <PlusIcon className="size-3.5" />
          </Button>
          <Select
            value={imageScale.toString()}
            onValueChange={(v) => onImageScaleChange?.(Number(v))}
          >
            <SelectTrigger size="sm" className="h-6! w-auto text-xs">
              <SelectValue>{Math.round(imageScale * 100)}%</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ZOOM_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onCropToggle && !fileName.toLowerCase().endsWith(".svg") && (
            <>
              <div className="mx-1 h-4 w-px bg-border" />
              <Button
                variant={cropMode ? "default" : "ghost"}
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={onCropToggle}
              >
                <CropIcon className="size-3.5" />
                Crop
              </Button>
            </>
          )}
          {editors.length === 1 && (
            <TooltipIconButton
              tooltip={`Open in ${editors[0].name}`}
              onClick={() => openInEditor(editors[0].id)}
            >
              <ExternalLinkIcon className="size-4" />
            </TooltipIconButton>
          )}
          {editors.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 p-1"
                  title="Open in Editor"
                >
                  <ExternalLinkIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {editors.map((editor) => (
                  <DropdownMenuItem
                    key={editor.id}
                    onClick={() => openInEditor(editor.id)}
                  >
                    {editor.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    );
  }

  if (fileType === "md") {
    return (
      <div className="flex h-[calc(36px+var(--titlebar-height))] items-center border-border border-b bg-muted/30 px-2 pt-[var(--titlebar-height)]">
        <div className="flex shrink-0 items-center gap-1">
          <SidebarToggle />
          <CollapsedPanelButtons />
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="shrink-0 font-medium text-muted-foreground text-sm">
            {fileName}
          </span>
        </div>
        <div
          ref={toolbarItemsRef}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden px-2"
        >
          <div
            data-toolbar-item="formatting"
            className="flex shrink-0 items-center gap-1"
          >
            <div className="mr-1 h-4 w-px shrink-0 bg-border" />
            <TooltipIconButton
              tooltip="Bold (**text**)"
              onClick={() => wrapSelection("**")}
            >
              <BoldIcon className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="Italic (*text*)"
              onClick={() => wrapSelection("*")}
            >
              <ItalicIcon className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="Code (`text`)"
              onClick={() => wrapSelection("`")}
            >
              <CodeIcon className="size-4" />
            </TooltipIconButton>
          </div>
          <div
            data-toolbar-item="structure"
            className="flex shrink-0 items-center gap-1"
          >
            <div className="mx-1 h-4 w-px shrink-0 bg-border" />
            <TooltipIconButton
              tooltip="Heading 1"
              onClick={() => insertText("# ", "")}
            >
              <Heading1Icon className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="Heading 2"
              onClick={() => insertText("## ", "")}
            >
              <Heading2Icon className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="List item"
              onClick={() => insertText("- ", "")}
            >
              <ListIcon className="size-4" />
            </TooltipIconButton>
          </div>
          <div
            data-toolbar-item="extras"
            className="flex shrink-0 items-center gap-1"
          >
            <div className="mx-1 h-4 w-px shrink-0 bg-border" />
            <TooltipIconButton
              tooltip="Link"
              onClick={() => insertText("[", "](url)")}
            >
              <LinkIcon className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="Blockquote"
              onClick={() => insertText("> ", "")}
            >
              <QuoteIcon className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="Inline math ($...$)"
              onClick={() => wrapSelection("$")}
            >
              <MdMathIcon className="size-4" />
            </TooltipIconButton>
          </div>
          <div
            data-toolbar-item="panel-controls"
            className="flex shrink-0 items-center"
          >
            <PanelMoveControls panelId="editor" />
            <SplitViewToggle />
            {editors.length === 1 && (
              <TooltipIconButton
                tooltip={`Open in ${editors[0].name}`}
                onClick={() => openInEditor(editors[0].id)}
              >
                <ExternalLinkIcon className="size-4" />
              </TooltipIconButton>
            )}
            {editors.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 p-1"
                    title="Open in Editor"
                  >
                    <ExternalLinkIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {editors.map((editor) => (
                    <DropdownMenuItem
                      key={editor.id}
                      onClick={() => openInEditor(editor.id)}
                    >
                      {editor.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {toolbarOverflow && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 size-7 shrink-0"
                title="More actions"
              >
                <MoreHorizontalIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hiddenIds.has("formatting") && (
                <>
                  <DropdownMenuItem onClick={() => wrapSelection("**")}>
                    <BoldIcon className="mr-2 size-3.5" />
                    Bold
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => wrapSelection("*")}>
                    <ItalicIcon className="mr-2 size-3.5" />
                    Italic
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => wrapSelection("`")}>
                    <CodeIcon className="mr-2 size-3.5" />
                    Code
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {hiddenIds.has("structure") && (
                <>
                  <DropdownMenuItem onClick={() => insertText("# ", "")}>
                    <Heading1Icon className="mr-2 size-3.5" />
                    Heading 1
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText("## ", "")}>
                    <Heading2Icon className="mr-2 size-3.5" />
                    Heading 2
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText("- ", "")}>
                    <ListIcon className="mr-2 size-3.5" />
                    List item
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {hiddenIds.has("extras") && (
                <>
                  <DropdownMenuItem onClick={() => insertText("[", "](url)")}>
                    <LinkIcon className="mr-2 size-3.5" />
                    Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => insertText("> ", "")}>
                    <QuoteIcon className="mr-2 size-3.5" />
                    Blockquote
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => wrapSelection("$")}>
                    <MdMathIcon className="mr-2 size-3.5" />
                    Inline math
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(36px+var(--titlebar-height))] items-center border-border border-b bg-muted/30 px-2 pt-[var(--titlebar-height)]">
      <div className="flex shrink-0 items-center gap-1">
        <SidebarToggle />
        <CollapsedPanelButtons />
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-medium text-muted-foreground text-sm">
          {fileName}
        </span>
      </div>
      <div
        ref={toolbarItemsRef}
        className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden px-2"
      >
        <div
          data-toolbar-item="formatting"
          className="flex shrink-0 items-center gap-1"
        >
          <div className="mr-1 h-4 w-px shrink-0 bg-border" />
          <TooltipIconButton
            tooltip="Bold (\\textbf)"
            onClick={() => insertText("\\textbf{", "}")}
          >
            <BoldIcon className="size-4" />
          </TooltipIconButton>
          <TooltipIconButton
            tooltip="Italic (\\textit)"
            onClick={() => insertText("\\textit{", "}")}
          >
            <ItalicIcon className="size-4" />
          </TooltipIconButton>
          <TooltipIconButton
            tooltip="Code (\\texttt)"
            onClick={() => insertText("\\texttt{", "}")}
          >
            <CodeIcon className="size-4" />
          </TooltipIconButton>
        </div>
        <div
          data-toolbar-item="structure"
          className="flex shrink-0 items-center gap-1"
        >
          <div className="mx-1 h-4 w-px shrink-0 bg-border" />
          <TooltipIconButton
            tooltip="Section"
            onClick={() => insertText("\\section{", "}")}
          >
            <Heading1Icon className="size-4" />
          </TooltipIconButton>
          <TooltipIconButton
            tooltip="Subsection"
            onClick={() => insertText("\\subsection{", "}")}
          >
            <Heading2Icon className="size-4" />
          </TooltipIconButton>
          <TooltipIconButton
            tooltip="List item"
            onClick={() => insertText("\\item ")}
          >
            <ListIcon className="size-4" />
          </TooltipIconButton>
        </div>
        <div
          data-toolbar-item="math"
          className="flex shrink-0 items-center gap-1"
        >
          <div className="mx-1 h-4 w-px shrink-0 bg-border" />
          <TooltipIconButton
            tooltip="Inline math ($...$)"
            onClick={() => wrapSelection("$")}
          >
            <FunctionSquareIcon className="size-4" />
          </TooltipIconButton>
          <TooltipIconButton
            tooltip="Display math (\\[...\\])"
            onClick={() => insertText("\\[\n  ", "\n\\]")}
          >
            <span className="font-mono text-xs">∫</span>
          </TooltipIconButton>
          <div className="mx-1 h-4 w-px shrink-0 bg-border" />
          <TooltipIconButton
            tooltip="Citation (\\cite)"
            onClick={() => insertText("\\cite{", "}")}
          >
            <BookMarkedIcon className="size-4" />
          </TooltipIconButton>
        </div>
        <div
          data-toolbar-item="panel-controls"
          className="flex shrink-0 items-center"
        >
          <PanelMoveControls panelId="editor" />
          <SplitViewToggle />
          {editors.length === 1 && (
            <TooltipIconButton
              tooltip={`Open in ${editors[0].name}`}
              onClick={() => openInEditor(editors[0].id)}
            >
              <ExternalLinkIcon className="size-4" />
            </TooltipIconButton>
          )}
          {editors.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 p-1"
                  title="Open in Editor"
                >
                  <ExternalLinkIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {editors.map((editor) => (
                  <DropdownMenuItem
                    key={editor.id}
                    onClick={() => openInEditor(editor.id)}
                  >
                    {editor.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {toolbarOverflow && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-1 size-7 shrink-0"
              title="More actions"
            >
              <MoreHorizontalIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hiddenIds.has("formatting") && (
              <>
                <DropdownMenuItem onClick={() => insertText("\\textbf{", "}")}>
                  <BoldIcon className="mr-2 size-3.5" />
                  Bold
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertText("\\textit{", "}")}>
                  <ItalicIcon className="mr-2 size-3.5" />
                  Italic
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertText("\\texttt{", "}")}>
                  <CodeIcon className="mr-2 size-3.5" />
                  Code
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {hiddenIds.has("structure") && (
              <>
                <DropdownMenuItem onClick={() => insertText("\\section{", "}")}>
                  <Heading1Icon className="mr-2 size-3.5" />
                  Section
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => insertText("\\subsection{", "}")}
                >
                  <Heading2Icon className="mr-2 size-3.5" />
                  Subsection
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertText("\\item ")}>
                  <ListIcon className="mr-2 size-3.5" />
                  List item
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {hiddenIds.has("math") && (
              <>
                <DropdownMenuItem onClick={() => wrapSelection("$")}>
                  <FunctionSquareIcon className="mr-2 size-3.5" />
                  Inline math
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => insertText("\\[\n  ", "\n\\]")}
                >
                  <span className="mr-2 w-3.5 text-center font-mono text-xs">
                    ∫
                  </span>
                  Display math
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertText("\\cite{", "}")}>
                  <BookMarkedIcon className="mr-2 size-3.5" />
                  Citation
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function SplitViewToggle() {
  const chatViewMode = useUIStore((s) => s.chatViewMode);
  const setChatViewMode = useUIStore((s) => s.setChatViewMode);
  const isSplit = chatViewMode === "split";

  return (
    <TooltipIconButton
      tooltip={isSplit ? "Claude: switch to drawer" : "Claude: split view"}
      onClick={() => setChatViewMode(isSplit ? "drawer" : "split")}
    >
      {isSplit ? (
        <MessageCircleIcon className="size-4" />
      ) : (
        <PanelRightIcon className="size-4" />
      )}
    </TooltipIconButton>
  );
}

function SidebarToggle() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  if (!sidebarCollapsed) return null;

  return (
    <>
      <TooltipIconButton tooltip="Show sidebar" onClick={toggleSidebar}>
        <PanelLeftIcon className="size-4" />
      </TooltipIconButton>
      <div className="mx-1 h-4 w-px bg-border" />
    </>
  );
}

const PANEL_LABELS: Record<PanelId, { label: string; icon: typeof EyeIcon }> = {
  editor: { label: "Editor", icon: FileTextIcon },
  pdf: { label: "Preview", icon: EyeIcon },
  chat: { label: "Claude", icon: BotMessageSquareIcon },
};

function CollapsedPanelButtons() {
  const collapsedPanels = useUIStore((s) => s.collapsedPanels);
  const chatViewMode = useUIStore((s) => s.chatViewMode);
  const panelOrder = useUIStore((s) => s.panelOrder);
  const isSplit = chatViewMode === "split";

  // Build list of collapsed panels that should show restore buttons
  const collapsedList = panelOrder.filter((id) => {
    if (id === "chat" && !isSplit) return false;
    return collapsedPanels.has(id);
  });

  if (collapsedList.length === 0) return null;

  return (
    <>
      {collapsedList.map((id) => {
        const { label, icon: Icon } = PANEL_LABELS[id];
        return (
          <TooltipIconButton
            key={id}
            tooltip={`Show ${label}`}
            onClick={() => {
              const ref = getPanelRef(id);
              if (ref) ref.expand();
            }}
          >
            <Icon className="size-4" />
          </TooltipIconButton>
        );
      })}
      <div className="mx-1 h-4 w-px bg-border" />
    </>
  );
}
