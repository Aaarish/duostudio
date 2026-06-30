import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useBoard, type BoardApi } from "@/whiteboard/useBoard";
import { BoardCanvas, type BoardCanvasHandle } from "@/whiteboard/BoardCanvas";
import { Toolbar } from "@/whiteboard/Toolbar";
import { useShortcuts } from "@/whiteboard/useShortcuts";
import { Keyboard, Copy, FileDown, Maximize2, Minimize2, ArrowLeftRight, ArrowRightLeft, Save, Loader2, Check } from "lucide-react";
import jsPDF from "jspdf";
import { fetchBoardRequest, updateBoardRequest, createBoardRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Shape } from "@/whiteboard/types";

type StudioSearch = { boardId?: string };

export const Route = createFileRoute("/")({
  component: Index,
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    boardId: typeof search.boardId === "string" ? search.boardId : undefined,
  }),
});

type BoardMeta = { id: string; version: number };

type ZoomState = "none" | "left" | "right";

function Index() {
  const { boardId } = Route.useSearch();
  const { isAuthenticated } = useAuth();
  const left = useBoard();
  const right = useBoard();
  const leftRef = useRef<BoardCanvasHandle>(null);
  const rightRef = useRef<BoardCanvasHandle>(null);
  const [focused, setFocused] = useState<0 | 1>(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [zoom, setZoom] = useState<ZoomState>("none");
  const [leftMeta, setLeftMeta] = useState<BoardMeta | null>(null);
  const [rightMeta, setRightMeta] = useState<BoardMeta | null>(null);

  // Load board from `?boardId=` into the left canvas on mount / id change.
  useEffect(() => {
    let cancelled = false;
    if (!boardId) {
      // Reset both boards to a clean state (used on logout / home nav).
      left.replaceShapes([]);
      right.replaceShapes([]);
      left.setNotepadText("");
      right.setNotepadText("");
      setLeftMeta(null);
      setRightMeta(null);
      return;
    }
    (async () => {
      try {
        const board = await fetchBoardRequest(boardId);
        if (cancelled) return;
        const bd = board.boardData ?? { shapes: [] };
        const shapes = (bd.shapes ?? []) as Shape[];
        // Map backend board type → UI mode so the canvas renders correctly.
        const typeToMode: Record<string, "select" | "freestyle" | "text" | "flowchart"> = {
          SELECT: "select", FREESTYLE: "freestyle", TEXT: "text", FLOWCHART: "flowchart",
        };
        const mode = typeToMode[(board.type || "SELECT").toUpperCase()];
        if (mode) left.setMode(mode);
        left.replaceShapes(shapes);
        // If backend stored notepad text alongside shapes, restore it.
        const np = (bd as unknown as { notepadText?: string }).notepadText;
        if (typeof np === "string") left.setNotepadText(np);
        setLeftMeta({ id: board.id, version: board.version ?? 0 });
        setFocused(0);
      } catch (err) {
        console.error("Failed to load board", err);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const modeToType = (m: string): string => {
    switch (m) {
      case "text": return "TEXT";
      case "freestyle": return "FREESTYLE";
      case "flowchart": return "FLOWCHART";
      default: return "SELECT";
    }
  };

  const saveLeftMutation = useMutation({
    mutationFn: async () => {
      const shapes = left.state.shapes;
      const boardData = { shapes, notepadText: left.state.notepadText };
      const type = modeToType(left.state.mode);
      if (leftMeta) {
        return updateBoardRequest(leftMeta.id, { boardData, version: leftMeta.version, type });
      }
      return createBoardRequest({ type, boardData });
    },
    onSuccess: (board) => setLeftMeta({ id: board.id, version: board.version ?? (leftMeta?.version ?? 0) + 1 }),
  });

  const saveRightMutation = useMutation({
    mutationFn: async () => {
      const shapes = right.state.shapes;
      const boardData = { shapes, notepadText: right.state.notepadText };
      const type = modeToType(right.state.mode);
      if (rightMeta) {
        return updateBoardRequest(rightMeta.id, { boardData, version: rightMeta.version, type });
      }
      return createBoardRequest({ type, boardData });
    },
    onSuccess: (board) => setRightMeta({ id: board.id, version: board.version ?? (rightMeta?.version ?? 0) + 1 }),
  });


  useShortcuts([left, right], focused, setFocused, (idx, kind) => {
    const ref = idx === 0 ? leftRef.current : rightRef.current;
    ref?.spawnEditable(kind);
  });

  const focusedApi = focused === 0 ? left : right;

  const replicate = (from: BoardApi, to: BoardApi) => {
    // deep clone shapes with new ids so both boards are independent afterwards
    const cloned = from.state.shapes.map((s) => ({
      ...s,
      id: Math.random().toString(36).slice(2, 10),
    }));
    to.replaceShapes(cloned);
    to.setNotepadText(from.state.notepadText);
  };

  const svgToBlob = async (handle: BoardCanvasHandle | null): Promise<Blob | null> => {
    const svg = handle?.getSvg();
    const root = handle?.getRoot();
    if (!svg || !root) return null;
    const rect = root.getBoundingClientRect();
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(rect.width));
    clone.setAttribute("height", String(rect.height));
    const serialized = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    return svgBlob;
  };

  const rasterize = async (handle: BoardCanvasHandle | null): Promise<{ dataUrl: string; width: number; height: number } | null> => {
    const root = handle?.getRoot();
    if (!root) return null;
    const rect = root.getBoundingClientRect();
    const blob = await svgToBlob(handle);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = getComputedStyle(root).backgroundColor || "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      return { dataUrl: canvas.toDataURL("image/png"), width: rect.width, height: rect.height };
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const copyBoard = async (handle: BoardCanvasHandle | null, api: BoardApi) => {
    if (handle?.isNotepadMode()) {
      await navigator.clipboard.writeText(handle.getNotepad());
      return;
    }
    const raster = await rasterize(handle);
    if (!raster) return;
    try {
      const blob = await (await fetch(raster.dataUrl)).blob();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ClipItem = (window as any).ClipboardItem;
      if (ClipItem && navigator.clipboard && "write" in navigator.clipboard) {
        await navigator.clipboard.write([new ClipItem({ "image/png": blob })]);
      } else {
        await navigator.clipboard.writeText(raster.dataUrl);
      }
    } catch {
      // fallback: copy shape JSON
      await navigator.clipboard.writeText(JSON.stringify(api.state.shapes));
    }
  };

  const exportPdf = async (handle: BoardCanvasHandle | null, label: string) => {
    if (handle?.isNotepadMode()) {
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const text = handle.getNotepad() || "";
      const lines = pdf.splitTextToSize(text, 515);
      pdf.setFont("courier", "normal");
      pdf.setFontSize(11);
      pdf.text(lines, 40, 50);
      pdf.save(`${label}.pdf`);
      return;
    }
    const raster = await rasterize(handle);
    if (!raster) return;
    const orientation = raster.width >= raster.height ? "landscape" : "portrait";
    const pdf = new jsPDF({ unit: "px", orientation, format: [raster.width, raster.height] });
    pdf.addImage(raster.dataUrl, "PNG", 0, 0, raster.width, raster.height);
    pdf.save(`${label}.pdf`);
  };

  const leftFlex = zoom === "left" ? "flex-[4]" : zoom === "right" ? "flex-[0] opacity-0 pointer-events-none overflow-hidden" : "flex-1";
  const rightFlex = zoom === "right" ? "flex-[4]" : zoom === "left" ? "flex-[0] opacity-0 pointer-events-none overflow-hidden" : "flex-1";

  return (
    <div className="flex h-screen w-screen flex-col bg-background overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-baseline gap-3">
          <Link to="/" search={{}} className="font-display text-lg tracking-tight hover:opacity-80 transition-opacity"><b>DUO</b>STUDIO</Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            dual canvas studio · v0.1
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span>focus:</span>
            <button onClick={() => setFocused(0)} className={`px-2 py-0.5 rounded ${focused === 0 ? "bg-foreground text-background" : "hover:bg-muted"}`}>01</button>
            <button onClick={() => setFocused(1)} className={`px-2 py-0.5 rounded ${focused === 1 ? "bg-foreground text-background" : "hover:bg-muted"}`}>02</button>
          </div>
          <button
            onClick={() => setShowShortcuts((s) => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <Keyboard className="h-3.5 w-3.5" />
            shortcuts
          </button>
        </div>
      </header>

      <div className="relative flex-1 flex">
        {/* Left board */}
        <div className={`${leftFlex} relative border-r border-border transition-all duration-300 ease-out`}>
          <BoardCanvas ref={leftRef} api={left} focused={focused === 0} onFocus={() => setFocused(0)} label="Board 01" />
          <BoardActions
            label="Board 01"
            onCopy={() => copyBoard(leftRef.current, left)}
            onExport={() => exportPdf(leftRef.current, "board-01")}
            onReplicate={() => replicate(left, right)}
            replicateIcon="right"
            onZoom={() => setZoom(zoom === "left" ? "none" : "left")}
            zoomed={zoom === "left"}
            onSave={() => saveLeftMutation.mutate()}
            saving={saveLeftMutation.isPending}
            saved={saveLeftMutation.isSuccess && !saveLeftMutation.isPending}
            boardId={leftMeta?.id}
            isAuthenticated={isAuthenticated}
          />
        </div>

        {/* Floating Toolbar */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <Toolbar
            api={focusedApi}
            focused={true}
            onSpawnEditable={(kind) => {
              const ref = focused === 0 ? leftRef.current : rightRef.current;
              ref?.spawnEditable(kind);
            }}
          />
        </div>

        {/* Right board */}
        <div className={`${rightFlex} relative transition-all duration-300 ease-out`}>
          <BoardCanvas ref={rightRef} api={right} focused={focused === 1} onFocus={() => setFocused(1)} label="Board 02" />
          <BoardActions
            label="Board 02"
            onCopy={() => copyBoard(rightRef.current, right)}
            onExport={() => exportPdf(rightRef.current, "board-02")}
            onReplicate={() => replicate(right, left)}
            replicateIcon="left"
            onZoom={() => setZoom(zoom === "right" ? "none" : "right")}
            zoomed={zoom === "right"}
            onSave={() => saveRightMutation.mutate()}
            saving={saveRightMutation.isPending}
            saved={saveRightMutation.isSuccess && !saveRightMutation.isPending}
            boardId={rightMeta?.id}
            isAuthenticated={isAuthenticated}
          />
        </div>

        {showShortcuts && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm"
            onClick={() => setShowShortcuts(false)}
          >
            <div className="glass-panel rounded-xl p-6 max-w-2xl w-[90%]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-display text-base tracking-tight">Keyboard Shortcuts</h2>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">esc to dismiss</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                <ShortcutGroup title="Tools">
                  <Row k="V" label="Select" />
                  <Row k="R" label="Rectangle" />
                  <Row k="O" label="Ellipse" />
                  <Row k="D" label="Diamond" />
                  <Row k="L" label="Line" />
                  <Row k="A" label="Arrow" />
                  <Row k="P" label="Pen / Freestyle" />
                  <Row k="T" label="Text" />
                  <Row k="N" label="Sticky note" />
                </ShortcutGroup>
                <ShortcutGroup title="Modes & Boards">
                  <Row k="⇧M" label="Select mode" />
                  <Row k="⇧F" label="Freestyle mode" />
                  <Row k="⇧X" label="Text mode (notepad)" />
                  <Row k="⇧C" label="Flowchart mode" />
                  <Row k="1 / 2" label="Focus left / right board" />
                  <Row k="⌘Z / ⌘⇧Z" label="Undo / Redo" />
                  <Row k="⌘B / ⌘I" label="Bold / Italic text" />
                  <Row k="Del / Esc" label="Delete / Deselect" />
                </ShortcutGroup>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BoardActions({
  label, onCopy, onExport, onReplicate, replicateIcon, onZoom, zoomed,
  onSave, saving, saved, boardId, isAuthenticated,
}: {
  label: string;
  onCopy: () => void;
  onExport: () => void;
  onReplicate: () => void;
  replicateIcon: "left" | "right";
  onZoom: () => void;
  zoomed: boolean;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  boardId?: string;
  isAuthenticated: boolean;
}) {
  const ReplicateIcon = replicateIcon === "right" ? ArrowRightLeft : ArrowLeftRight;
  return (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-1 glass-panel rounded-md p-1">
      <ActionBtn title={`Replicate to other board`} onClick={onReplicate}><ReplicateIcon className="h-3.5 w-3.5" /></ActionBtn>
      <ActionBtn title="Copy to clipboard" onClick={onCopy}><Copy className="h-3.5 w-3.5" /></ActionBtn>
      {isAuthenticated && (
        <ActionBtn
          title={boardId ? `Save ${label} (updates board ${boardId.slice(0, 6)}…)` : `Save ${label} (creates new board)`}
          onClick={onSave}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Save className="h-3.5 w-3.5" />}
        </ActionBtn>
      )}
      <ActionBtn title="Export as PDF" onClick={onExport}><FileDown className="h-3.5 w-3.5" /></ActionBtn>
      <ActionBtn title={zoomed ? "Restore split view" : `Zoom ${label}`} onClick={onZoom}>
        {zoomed ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </ActionBtn>
    </div>
  );
}

function ActionBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}

function ShortcutGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Row({ k, label }: { k: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-foreground/80">{label}</span>
      <span className="kbd">{k}</span>
    </div>
  );
}
