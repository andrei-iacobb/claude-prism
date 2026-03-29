import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircleIcon,
  ArrowUpIcon,
  XIcon,
  BookOpenIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useZoteroStore } from "@/stores/zotero-store";
import { useDocumentStore } from "@/stores/document-store";

interface SelectionToastProps {
  position: { top: number; left: number };
  selectedText: string;
  onSendPrompt: (prompt: string) => void;
  onDismiss: () => void;
}

export function SelectionToast({
  position,
  selectedText,
  onSendPrompt,
  onDismiss,
}: SelectionToastProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const toastRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if Zotero is connected and has synced collections for this project
  const isZoteroAvailable = useZoteroStore((s) => {
    if (!s.isAuthenticated) return false;
    const projectRoot = useDocumentStore.getState().projectRoot;
    if (!projectRoot) return false;
    const synced = s.syncedCollections[projectRoot];
    return !!synced && Object.keys(synced).length > 0;
  });

  // Truncate the selected text for display
  const preview =
    selectedText.length > 60
      ? `${selectedText.slice(0, 57).trim()}…`
      : selectedText;
  // Collapse to single line
  const displayText = preview.replace(/\n+/g, " ").trim();

  const handleSend = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setPrompt("");
    setIsExpanded(false);
    onSendPrompt(trimmed);
  }, [prompt, onSendPrompt]);

  const handleCheckReferences = useCallback(() => {
    onSendPrompt(
      "Check the references and citations in this text against the Zotero bibliography. " +
        "Identify any missing citations, suggest relevant existing references from the .bib file, " +
        "and flag any \\cite keys that don't match bibliography entries.",
    );
  }, [onSendPrompt]);

  const handleChatClick = useCallback(() => {
    setIsExpanded(true);
    // Focus input after expansion animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (isExpanded) {
          setIsExpanded(false);
          setPrompt("");
        } else {
          onDismiss();
        }
      }
    },
    [handleSend, isExpanded, onDismiss],
  );

  // Dismiss on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (toastRef.current && !toastRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    // Delay to avoid dismissing from the selection click itself
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleMouseDown);
    }, 150);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [onDismiss]);

  return (
    <div
      ref={toastRef}
      className={cn(
        "absolute z-30 animate-in fade-in slide-in-from-bottom-1 duration-150",
        isExpanded ? "w-80" : "max-w-80",
      )}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-background/95 shadow-lg backdrop-blur-sm transition-all duration-150",
        )}
      >
        {/* Collapsed: highlight preview + action buttons */}
        {!isExpanded && (
          <div className="flex items-center gap-1.5 py-1.5 pr-1.5 pl-3">
            <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs leading-tight">
              &ldquo;{displayText}&rdquo;
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {isZoteroAvailable && (
                <button
                  onClick={handleCheckReferences}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/50 px-2 py-1 font-medium text-foreground text-xs transition-colors hover:bg-muted"
                  title="Check references against Zotero bibliography"
                >
                  <BookOpenIcon className="size-3" />
                  Refs
                </button>
              )}
              <button
                onClick={handleChatClick}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 font-medium text-primary-foreground text-xs transition-colors hover:bg-primary/90"
              >
                <MessageCircleIcon className="size-3" />
                Chat
              </button>
            </div>
          </div>
        )}

        {/* Expanded: highlighted text + prompt input */}
        {isExpanded && (
          <div className="flex flex-col">
            {/* Context chip */}
            <div className="flex items-center gap-2 border-border border-b px-3 py-2">
              <div className="min-w-0 flex-1 truncate rounded-md bg-muted/60 px-2 py-1 font-mono text-[11px] text-muted-foreground leading-tight">
                &ldquo;{displayText}&rdquo;
              </div>
              <button
                onClick={() => {
                  setIsExpanded(false);
                  setPrompt("");
                }}
                className="shrink-0 rounded-md p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </div>
            {/* Quick actions row */}
            {isZoteroAvailable && (
              <div className="flex items-center gap-1.5 border-border border-b px-3 py-1.5">
                <button
                  onClick={handleCheckReferences}
                  className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <BookOpenIcon className="size-3" />
                  Check references
                </button>
              </div>
            )}
            {/* Prompt input */}
            <div className="flex items-center gap-1.5 px-3 py-2">
              <input
                ref={inputRef}
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this selection…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              />
              <button
                aria-label="Send"
                onClick={handleSend}
                disabled={!prompt.trim()}
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
              >
                <ArrowUpIcon className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
