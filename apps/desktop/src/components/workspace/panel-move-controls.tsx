import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PanelLeftCloseIcon,
} from "lucide-react";
import { useUIStore, type PanelId } from "@/stores/ui-store";
import { getPanelRef } from "./workspace-layout";

interface PanelMoveControlsProps {
  panelId: PanelId;
  /** Show collapse button even when not in split mode. Defaults to true. */
  showCollapse?: boolean;
}

export function PanelMoveControls({
  panelId,
  showCollapse = true,
}: PanelMoveControlsProps) {
  const panelOrder = useUIStore((s) => s.panelOrder);
  const chatViewMode = useUIStore((s) => s.chatViewMode);
  const movePanelLeft = useUIStore((s) => s.movePanelLeft);
  const movePanelRight = useUIStore((s) => s.movePanelRight);

  const isSplit = chatViewMode === "split";
  const idx = panelOrder.indexOf(panelId);
  const canMoveLeft = idx > 0;
  const canMoveRight = idx < panelOrder.length - 1;

  const handleCollapse = () => {
    const ref = getPanelRef(panelId);
    if (ref) ref.collapse();
  };

  return (
    <div className="flex items-center gap-px">
      {/* Move arrows — only in split mode */}
      {isSplit && (
        <>
          <button
            type="button"
            onClick={() => movePanelLeft(panelId)}
            disabled={!canMoveLeft}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            aria-label="Move panel left"
            title="Move left"
          >
            <ChevronLeftIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => movePanelRight(panelId)}
            disabled={!canMoveRight}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            aria-label="Move panel right"
            title="Move right"
          >
            <ChevronRightIcon className="size-3.5" />
          </button>
        </>
      )}
      {/* Collapse button */}
      {showCollapse && (
        <button
          type="button"
          onClick={handleCollapse}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Collapse panel"
          title="Collapse panel"
        >
          <PanelLeftCloseIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}
