import { forwardRef, useImperativeHandle, useRef, useState, useEffect, type PointerEvent as RPE } from "react";
import type { BoardApi } from "./useBoard";
import type { Shape, FreestyleShape, TextShape, StickyShape } from "./types";
import { Copy, Trash2, X } from "lucide-react";

interface Props {
  api: BoardApi;
  focused: boolean;
  onFocus: () => void;
  label: string;
}

export interface BoardCanvasHandle {
  getSvg: () => SVGSVGElement | null;
  getRoot: () => HTMLDivElement | null;
  getNotepad: () => string;
  isNotepadMode: () => boolean;
  spawnEditable: (kind: "text" | "sticky") => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const snap = (n: number, grid: number) => Math.round(n / grid) * grid;

export const BoardCanvas = forwardRef<BoardCanvasHandle, Props>(function BoardCanvas({ api, focused, onFocus, label }, ref) {
  const { state, addShape, updateShape, select, commit, setNotepadText } = api;
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [pending, setPending] = useState<{ x: number; y: number; tool: string } | null>(null);
  const [drag, setDrag] = useState<
    | { kind: "move"; id: string; offX: number; offY: number }
    | { kind: "resize"; id: string; handle: string; startW: number; startH: number; startX: number; startY: number; px: number; py: number }
    | null
  >(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Lasso (freestyle-mode group selection)
  const [lassoPath, setLassoPath] = useState<{ x: number; y: number }[] | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [groupDrag, setGroupDrag] = useState<
    | { kind: "move"; startPt: { x: number; y: number }; orig: Map<string, Shape> }
    | { kind: "resize"; handle: string; box: { x: number; y: number; w: number; h: number }; orig: Map<string, Shape> }
    | null
  >(null);

  // Infinite canvas pan offset (world translate). Hand tool drags this.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panDrag, setPanDrag] = useState<{ sx: number; sy: number; px: number; py: number } | null>(null);

  // clear group when leaving freestyle mode or switching tools
  useEffect(() => {
    if (state.mode !== "freestyle" || state.tool !== "lasso") {
      setLassoPath(null);
    }
    if (state.mode !== "freestyle") setGroupIds([]);
  }, [state.mode, state.tool]);

  useImperativeHandle(ref, () => ({
    getSvg: () => svgRef.current,
    getRoot: () => rootRef.current,
    getNotepad: () => state.notepadText,
    isNotepadMode: () => state.mode === "text",
    spawnEditable: (kind: "text" | "sticky") => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const id = uid();
      if (kind === "text") {
        const shape: TextShape = {
          id, kind: "text", x: cx - 90, y: cy - (state.style.fontSize + 12) / 2, w: 180, h: state.style.fontSize + 12,
          stroke: state.style.stroke, fill: "transparent", strokeWidth: state.style.strokeWidth,
          text: "", fontSize: state.style.fontSize, fontWeight: state.style.fontWeight, italic: state.style.italic,
        };
        addShape(shape);
      } else {
        const shape: StickyShape = {
          id, kind: "sticky", x: cx - 80, y: cy - 70, w: 160, h: 140,
          stroke: "oklch(0.35 0.08 85)", fill: "oklch(0.92 0.12 95)", strokeWidth: 1,
          text: "", fontSize: 14, fontWeight: 400, italic: false,
        };
        addShape(shape);
      }
      setEditingTextId(id);
    },
  }), [state.notepadText, state.mode, state.style, addShape]);

  const useGrid = state.mode === "flowchart";
  const grid = 12;

  const getPt = (e: RPE) => {
    const rect = svgRef.current!.getBoundingClientRect();
    let x = e.clientX - rect.left - pan.x;
    let y = e.clientY - rect.top - pan.y;
    if (useGrid) { x = snap(x, grid); y = snap(y, grid); }
    return { x, y };
  };

  const baseStyle = () => ({
    stroke: state.style.stroke,
    fill: state.style.fill,
    strokeWidth: state.style.strokeWidth,
  });

  const onPointerDown = (e: RPE) => {
    if (editingTextId) return;
    onFocus();
    if ((e.target as Element).getAttribute("data-handle")) return;
    const gh = (e.target as Element).getAttribute("data-group-handle");
    if (gh && gh !== "move") return; // resize handles handle themselves; "move" should fall through to lasso branch

    // Hand / pan tool — drag the canvas
    if (state.tool === "pan") {
      setPanDrag({ sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y });
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }

    const pt = getPt(e);
    const tool = state.tool;

    if (tool === "lasso") {
      // If clicking inside an existing group's bounding box → start group move
      if (groupIds.length > 0) {
        const box = bboxOfShapes(state.shapes.filter((s) => groupIds.includes(s.id)));
        if (box && pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h) {
          const orig = new Map<string, Shape>();
          state.shapes.filter((s) => groupIds.includes(s.id)).forEach((s) => orig.set(s.id, { ...s }));
          setGroupDrag({ kind: "move", startPt: pt, orig });
          (e.target as Element).setPointerCapture?.(e.pointerId);
          return;
        }
      }
      // Otherwise start a new lasso path
      setGroupIds([]);
      setLassoPath([pt]);
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }

    if (tool === "select") {
      const targetId = (e.target as Element).getAttribute("data-shape-id");
      if (targetId) {
        const shape = state.shapes.find((s) => s.id === targetId);
        if (shape) {
          select(targetId);
          setDrag({ kind: "move", id: targetId, offX: pt.x - shape.x, offY: pt.y - shape.y });
        }
      } else {
        select(null);
      }
      return;
    }

    // For non-select tools: defer creation until the user actually drags.
    // A plain click should NOT create anything — and on a single click we
    // also revert to the select tool (single-click-to-select shortcut).
    setPending({ x: pt.x, y: pt.y, tool });
  };

  const beginDraftFromPending = (pt: { x: number; y: number }) => {
    if (!pending) return;
    const tool = pending.tool;
    const startX = pending.x, startY = pending.y;

    if (tool === "text") {
      const id = uid();
      const shape: TextShape = {
        id, kind: "text", x: startX, y: startY, w: Math.max(120, pt.x - startX), h: state.style.fontSize + 12,
        ...baseStyle(),
        fill: "transparent",
        text: "",
        fontSize: state.style.fontSize,
        fontWeight: state.style.fontWeight,
        italic: state.style.italic,
      };
      addShape(shape);
      setEditingTextId(id);
      setPending(null);
      return;
    }
    if (tool === "sticky") {
      const id = uid();
      const w = Math.max(80, Math.abs(pt.x - startX));
      const h = Math.max(80, Math.abs(pt.y - startY));
      const x = Math.min(startX, pt.x);
      const y = Math.min(startY, pt.y);
      const shape: StickyShape = {
        id, kind: "sticky", x, y, w, h,
        stroke: "oklch(0.35 0.08 85)",
        fill: "oklch(0.92 0.12 95)",
        strokeWidth: 1,
        text: "",
        fontSize: 14,
        fontWeight: 400,
        italic: false,
      };
      addShape(shape);
      setEditingTextId(id);
      setPending(null);
      return;
    }
    if (tool === "freestyle") {
      const shape: FreestyleShape = {
        id: uid(), kind: "freestyle",
        x: startX, y: startY, w: 0, h: 0,
        ...baseStyle(),
        fill: "transparent",
        points: [{ x: startX, y: startY }, pt],
      };
      setDraft(shape);
      setPending(null);
      return;
    }
    // shape tools
    const draftShape: Shape = {
      id: uid(),
      kind: tool as Shape["kind"],
      x: startX, y: startY, w: pt.x - startX, h: pt.y - startY,
      ...baseStyle(),
    } as Shape;
    setDraft(draftShape);
    setPending(null);
  };

  const onPointerMove = (e: RPE) => {
    // Pan drag uses raw client coords (independent of pan offset)
    if (panDrag) {
      setPan({ x: panDrag.px + (e.clientX - panDrag.sx), y: panDrag.py + (e.clientY - panDrag.sy) });
      return;
    }
    const pt = getPt(e);

    // Lasso group drag (move) ----------------
    if (groupDrag?.kind === "move") {
      const dx = pt.x - groupDrag.startPt.x;
      const dy = pt.y - groupDrag.startPt.y;
      groupDrag.orig.forEach((orig, id) => {
        const patch: Partial<Shape> = { x: orig.x + dx, y: orig.y + dy };
        if (orig.kind === "freestyle") {
          (patch as Partial<FreestyleShape>).points = orig.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        }
        updateShape(id, patch);
      });
      return;
    }
    if (groupDrag?.kind === "resize") {
      const box = groupDrag.box;
      let nx = box.x, ny = box.y, nw = box.w, nh = box.h;
      const dx = pt.x - (box.x + (groupDrag.handle.includes("e") ? box.w : 0));
      const dy = pt.y - (box.y + (groupDrag.handle.includes("s") ? box.h : 0));
      if (groupDrag.handle.includes("e")) nw = Math.max(20, box.w + dx);
      if (groupDrag.handle.includes("s")) nh = Math.max(20, box.h + dy);
      if (groupDrag.handle.includes("w")) {
        const ddx = pt.x - box.x;
        nx = box.x + ddx; nw = Math.max(20, box.w - ddx);
      }
      if (groupDrag.handle.includes("n")) {
        const ddy = pt.y - box.y;
        ny = box.y + ddy; nh = Math.max(20, box.h - ddy);
      }
      const sx = nw / box.w;
      const sy = nh / box.h;
      groupDrag.orig.forEach((orig, id) => {
        const px = nx + (orig.x - box.x) * sx;
        const py = ny + (orig.y - box.y) * sy;
        const patch: Partial<Shape> = { x: px, y: py, w: orig.w * sx, h: orig.h * sy };
        if (orig.kind === "freestyle") {
          (patch as Partial<FreestyleShape>).points = orig.points.map((p) => ({
            x: nx + (p.x - box.x) * sx,
            y: ny + (p.y - box.y) * sy,
          }));
        }
        updateShape(id, patch);
      });
      return;
    }

    // Lasso path drawing ----------------
    if (lassoPath) {
      const last = lassoPath[lassoPath.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) >= 2) {
        setLassoPath([...lassoPath, pt]);
      }
      return;
    }

    if (drag?.kind === "move") {
      const shape = state.shapes.find((s) => s.id === drag.id);
      if (!shape) return;
      let nx = pt.x - drag.offX;
      let ny = pt.y - drag.offY;
      if (useGrid) { nx = snap(nx, grid); ny = snap(ny, grid); }
      updateShape(drag.id, { x: nx, y: ny });
      return;
    }
    if (drag?.kind === "resize") {
      const dx = pt.x - drag.px;
      const dy = pt.y - drag.py;
      let { startX, startY, startW, startH } = drag;
      let nx = startX, ny = startY, nw = startW, nh = startH;
      if (drag.handle.includes("e")) nw = Math.max(8, startW + dx);
      if (drag.handle.includes("s")) nh = Math.max(8, startH + dy);
      if (drag.handle.includes("w")) { nx = startX + dx; nw = Math.max(8, startW - dx); }
      if (drag.handle.includes("n")) { ny = startY + dy; nh = Math.max(8, startH - dy); }
      updateShape(drag.id, { x: nx, y: ny, w: nw, h: nh });
      return;
    }

    if (pending) {
      const dx = pt.x - pending.x;
      const dy = pt.y - pending.y;
      if (Math.hypot(dx, dy) > 4) {
        beginDraftFromPending(pt);
      }
      return;
    }

    if (!draft) return;
    if (draft.kind === "freestyle") {
      const f = draft as FreestyleShape;
      const last = f.points[f.points.length - 1];
      // Distance-throttle for smoothness; smoothing happens in the renderer
      if (Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) return;
      setDraft({ ...f, points: [...f.points, pt] });
      return;
    }
    setDraft({ ...draft, w: pt.x - draft.x, h: pt.y - draft.y });
  };

  const onPointerUp = () => {
    if (panDrag) {
      setPanDrag(null);
      return;
    }
    if (groupDrag) {
      commit();
      setGroupDrag(null);
      return;
    }
    if (lassoPath) {
      const poly = lassoPath;
      setLassoPath(null);
      if (poly.length >= 3) {
        const ids = state.shapes.filter((s) => shapeInsidePolygon(s, poly)).map((s) => s.id);
        setGroupIds(ids);
      } else {
        // Plain click on lasso tool → toggle back to pen
        if (state.mode === "freestyle") api.setTool("freestyle");
      }
      return;
    }
    if (drag) {
      commit();
      setDrag(null);
      setPending(null);
      return;
    }
    if (pending) {
      // Plain click without drag.
      const wasTool = pending.tool;
      setPending(null);
      if (state.mode === "freestyle") {
        // Toggle between pen and lasso on single click.
        api.setTool(wasTool === "freestyle" ? "lasso" : "freestyle");
      } else {
        api.setTool("select");
        select(null);
      }
      return;
    }
    if (!draft) return;
    let final: Shape = draft;
    // normalize negative w/h
    if (draft.kind !== "freestyle") {
      let { x, y, w, h } = draft;
      if (w < 0) { x += w; w = -w; }
      if (h < 0) { y += h; h = -h; }
      if (w < 4 && h < 4) { setDraft(null); return; }
      final = { ...draft, x, y, w: Math.max(w, 8), h: Math.max(h, 8) };
    } else {
      const f = draft as FreestyleShape;
      if (f.points.length < 2) { setDraft(null); return; }
      const xs = f.points.map((p) => p.x), ys = f.points.map((p) => p.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      final = { ...f, x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    addShape(final);
    if (final.kind === "text" || final.kind === "sticky") {
      setEditingTextId(final.id);
    } else if (final.kind === "freestyle") {
      // Don't auto-select pen strokes — avoids the dashed selection box flash.
      select(null);
    }
    setDraft(null);
  };

  const handleTextEdit = (id: string, value: string) => {
    updateShape(id, { text: value } as Partial<TextShape>);
  };

  const allShapes = draft ? [...state.shapes, draft] : state.shapes;
  const selected = state.shapes.find((s) => s.id === state.selectedId) || null;

  const isNotepad = state.mode === "text";

  return (
    <div
      ref={rootRef}
      data-board-root
      className={`relative h-full w-full overflow-hidden transition-shadow ${isNotepad ? "notepad-bg" : "canvas-grid-bg"} ${focused ? "focused-board" : ""}`}
      style={!isNotepad ? { backgroundPosition: `${pan.x}px ${pan.y}px` } : undefined}
      onPointerDown={onFocus}
    >
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-md glass-panel">
        <span className={`h-1.5 w-1.5 rounded-full ${focused ? "bg-[var(--color-accent-saffron)]" : "bg-muted-foreground/40"}`} />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <span className="kbd ml-1">{label === "Board 01" ? "1" : "2"}</span>
        <span className="font-mono text-[10px] text-muted-foreground/70 ml-2">
          mode: <span className="text-foreground">{state.mode}</span>
        </span>
      </div>

      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full select-none"
        style={{
          cursor:
            state.tool === "pan" ? (panDrag ? "grabbing" : "grab") :
            state.tool === "select" ? "default" :
            state.tool === "text" ? "text" :
            state.tool === "lasso" ? "crosshair" :
            "crosshair",
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onDoubleClick={(e) => {
          const targetId = (e.target as Element).getAttribute("data-shape-id");
          if (targetId) {
            const s = state.shapes.find((sh) => sh.id === targetId);
            if (s && (s.kind === "text" || s.kind === "sticky")) {
              setEditingTextId(s.id);
              e.preventDefault();
            }
          }
        }}
      >
        <g transform={`translate(${pan.x} ${pan.y})`}>
        {allShapes.map((s) => (
          <ShapeNode
            key={s.id}
            shape={s}
            selected={s.id === state.selectedId || groupIds.includes(s.id)}
            editing={editingTextId === s.id}
          />
        ))}

        {selected && !editingTextId && groupIds.length === 0 && (
          <SelectionHandles
            shape={selected}
            onResizeStart={(handle, e) => {
              const pt = getPt(e);
              setDrag({
                kind: "resize",
                id: selected.id,
                handle,
                startX: selected.x,
                startY: selected.y,
                startW: selected.w,
                startH: selected.h,
                px: pt.x,
                py: pt.y,
              });
            }}
          />
        )}

        {/* Lasso live path */}
        {lassoPath && lassoPath.length > 1 && (
          <path
            d={lassoPath.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z"}
            fill="oklch(0.72 0.18 55 / 0.10)"
            stroke="var(--color-accent-saffron)"
            strokeWidth={1.25}
            strokeDasharray="6 4"
            pointerEvents="none"
          />
        )}

        {/* Group bbox + handles */}
        {(() => {
          if (groupIds.length === 0) return null;
          const groupShapes = state.shapes.filter((s) => groupIds.includes(s.id));
          const box = bboxOfShapes(groupShapes);
          if (!box) return null;
          const handles = [
            ["nw", box.x, box.y],
            ["ne", box.x + box.w, box.y],
            ["sw", box.x, box.y + box.h],
            ["se", box.x + box.w, box.y + box.h],
          ] as const;
          return (
            <g>
              <rect
                data-group-handle="move"
                x={box.x - 4} y={box.y - 4} width={box.w + 8} height={box.h + 8}
                fill="oklch(0.72 0.18 55 / 0.06)"
                stroke="var(--color-accent-saffron)"
                strokeDasharray="5 3"
                strokeWidth={1.25}
                style={{ cursor: "move" }}
              />
              {handles.map(([h, x, y]) => (
                <rect
                  key={h}
                  data-group-handle={h}
                  x={x - 5} y={y - 5} width={10} height={10}
                  fill="var(--color-canvas)"
                  stroke="var(--color-accent-saffron)"
                  strokeWidth={1.5}
                  style={{ cursor: `${h}-resize` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const orig = new Map<string, Shape>();
                    groupShapes.forEach((s) => orig.set(s.id, { ...s }));
                    setGroupDrag({ kind: "resize", handle: h, box, orig });
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  }}
                />
              ))}
            </g>
          );
        })()}
        </g>
      </svg>

      {/* Group action panel */}
      {(() => {
        if (groupIds.length === 0) return null;
        const groupShapes = state.shapes.filter((s) => groupIds.includes(s.id));
        const box = bboxOfShapes(groupShapes);
        if (!box) return null;
        return (
          <div
            className="absolute z-20 flex items-center gap-1 glass-panel rounded-md p-1 shadow-md"
            style={{ left: box.x + box.w / 2 + pan.x, top: Math.max(8, box.y - 44 + pan.y), transform: "translateX(-50%)" }}
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground px-2">
              {groupIds.length} selected
            </span>
            <button
              title="Duplicate (copy)"
              onClick={() => {
                const offset = 20;
                const clones: Shape[] = groupShapes.map((s) => {
                  const id = uid();
                  const base = { ...s, id, x: s.x + offset, y: s.y + offset };
                  if (s.kind === "freestyle") {
                    return { ...(base as FreestyleShape), points: s.points.map((p) => ({ x: p.x + offset, y: p.y + offset })) };
                  }
                  return base as Shape;
                });
                clones.forEach((c) => addShape(c));
                setGroupIds(clones.map((c) => c.id));
              }}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              title="Delete group"
              onClick={() => {
                groupIds.forEach((id) => {
                  // soft-delete by selecting then deleting
                  api.select(id);
                  api.deleteSelected();
                });
                setGroupIds([]);
              }}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-destructive/10 text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              title="Dismiss selection"
              onClick={() => setGroupIds([])}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })()}

      {/* text & sticky editing overlay */}
      {state.shapes.map((s) =>
        (s.kind === "text" || s.kind === "sticky") && editingTextId === s.id ? (
          <textarea
            key={s.id}
            autoFocus
            value={(s as TextShape | StickyShape).text}
            onChange={(e) => updateShape(s.id, { text: e.target.value } as Partial<Shape>)}
            onBlur={() => { setEditingTextId(null); commit(); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setEditingTextId(null); commit(); }
              e.stopPropagation();
            }}
            className={`absolute outline-none rounded-sm resize-none ${s.kind === "sticky" ? "sticky-lines" : ""}`}
            style={{
              left: s.x + pan.x, top: s.y + pan.y,
              width: Math.max(s.w, 120),
              height: s.kind === "sticky" ? s.h : undefined,
              minHeight: (s as TextShape).fontSize + 12,
              padding: s.kind === "sticky" ? "4px 10px" : 8,
              background: s.kind === "sticky" ? s.fill : "transparent",
              border: "1px dashed var(--color-accent-saffron)",
              color: s.stroke,
              fontSize: (s as TextShape).fontSize,
              fontWeight: (s as TextShape).fontWeight,
              fontStyle: (s as TextShape).italic ? "italic" : "normal",
              fontFamily: "var(--font-sans)",
              lineHeight: s.kind === "sticky" ? "20px" : 1.25,
              transform: s.kind === "sticky" ? "rotate(-0.5deg)" : undefined,
              boxShadow: s.kind === "sticky" ? "2px 4px 10px -2px oklch(0 0 0 / 0.2)" : undefined,
            }}
          />
        ) : null
      )}

      {isNotepad && (
        <textarea
          value={state.notepadText}
          onChange={(e) => setNotepadText(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Untitled — Notepad"
          className="absolute inset-0 w-full h-full bg-transparent outline-none p-8 pt-16 resize-none"
          style={{ fontFamily: "Consolas, 'Lucida Console', monospace", fontSize: 15, lineHeight: "24px", color: "var(--color-ink)" }}
        />
      )}
    </div>
  );
});

function ShapeNode({ shape, selected, editing }: { shape: Shape; selected: boolean; editing: boolean }) {
  const common = {
    "data-shape-id": shape.id,
    stroke: shape.stroke,
    fill: shape.fill === "transparent" ? "transparent" : shape.fill,
    strokeWidth: shape.strokeWidth,
    style: { cursor: "move" as const },
  };
  const selStroke = selected ? "var(--color-accent-saffron)" : shape.stroke;

  if (shape.kind === "rectangle") {
    return <rect {...common} stroke={selStroke} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={4} />;
  }
  if (shape.kind === "ellipse") {
    return (
      <ellipse {...common} stroke={selStroke}
        cx={shape.x + shape.w / 2} cy={shape.y + shape.h / 2}
        rx={Math.abs(shape.w) / 2} ry={Math.abs(shape.h) / 2} />
    );
  }
  if (shape.kind === "diamond") {
    const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2;
    const points = `${cx},${shape.y} ${shape.x + shape.w},${cy} ${cx},${shape.y + shape.h} ${shape.x},${cy}`;
    return <polygon {...common} stroke={selStroke} points={points} />;
  }
  if (shape.kind === "line") {
    return <line {...common} stroke={selStroke} fill="none" x1={shape.x} y1={shape.y} x2={shape.x + shape.w} y2={shape.y + shape.h} />;
  }
  if (shape.kind === "arrow") {
    const x2 = shape.x + shape.w, y2 = shape.y + shape.h;
    const angle = Math.atan2(y2 - shape.y, x2 - shape.x);
    const ah = 10;
    const ax1 = x2 - ah * Math.cos(angle - Math.PI / 6);
    const ay1 = y2 - ah * Math.sin(angle - Math.PI / 6);
    const ax2 = x2 - ah * Math.cos(angle + Math.PI / 6);
    const ay2 = y2 - ah * Math.sin(angle + Math.PI / 6);
    return (
      <g data-shape-id={shape.id} style={{ cursor: "move" }}>
        <line stroke={selStroke} strokeWidth={shape.strokeWidth} x1={shape.x} y1={shape.y} x2={x2} y2={y2} data-shape-id={shape.id} />
        <polyline stroke={selStroke} strokeWidth={shape.strokeWidth} fill="none" points={`${ax1},${ay1} ${x2},${y2} ${ax2},${ay2}`} data-shape-id={shape.id} />
      </g>
    );
  }
  if (shape.kind === "freestyle") {
    const d = smoothPath(shape.points);
    return <path {...common} stroke={selStroke} fill="none" d={d} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (shape.kind === "sticky") {
    const t = shape as StickyShape;
    if (editing) return null;
    return (
      <foreignObject data-shape-id={shape.id} x={shape.x} y={shape.y} width={shape.w} height={shape.h} style={{ overflow: "visible", cursor: "move" }}>
        <div data-shape-id={shape.id} className="sticky-lines" style={{
          width: "100%", height: "100%", background: shape.fill,
          boxShadow: "2px 4px 10px -2px oklch(0 0 0 / 0.2)",
          padding: "4px 10px", fontSize: t.fontSize, lineHeight: "20px",
          fontFamily: "var(--font-sans)",
          color: shape.stroke, whiteSpace: "pre-wrap", userSelect: "none",
          border: selected ? "2px dashed var(--color-accent-saffron)" : "1px solid oklch(0.78 0.1 85)",
          borderRadius: 2,
          transform: "rotate(-0.5deg)",
        }}>{t.text || " "}</div>
      </foreignObject>
    );
  }
  if (shape.kind === "text") {
    const t = shape as TextShape;
    if (editing) return null;
    return (
      <foreignObject data-shape-id={shape.id} x={shape.x} y={shape.y} width={Math.max(shape.w, 120)} height={Math.max(shape.h, t.fontSize + 12)} style={{ overflow: "visible", cursor: "move" }}>
        <div
          data-shape-id={shape.id}
          style={{
            color: shape.stroke,
            fontSize: t.fontSize,
            fontWeight: t.fontWeight,
            fontStyle: t.italic ? "italic" : "normal",
            fontFamily: "var(--font-sans)",
            lineHeight: 1.25,
            padding: 4,
            border: selected ? "1px dashed var(--color-accent-saffron)" : "1px dashed transparent",
            borderRadius: 4,
            whiteSpace: "pre-wrap",
            userSelect: "none",
          }}
        >
          {t.text || " "}
        </div>
      </foreignObject>
    );
  }
  return null;
}

function SelectionHandles({
  shape, onResizeStart,
}: { shape: Shape; onResizeStart: (handle: string, e: RPE) => void }) {
  const handles = [
    ["nw", shape.x, shape.y],
    ["ne", shape.x + shape.w, shape.y],
    ["sw", shape.x, shape.y + shape.h],
    ["se", shape.x + shape.w, shape.y + shape.h],
  ] as const;
  return (
    <g>
      <rect x={shape.x - 2} y={shape.y - 2} width={shape.w + 4} height={shape.h + 4}
        fill="none" stroke="var(--color-accent-saffron)" strokeDasharray="4 3" strokeWidth={1} pointerEvents="none" />
      {handles.map(([h, x, y]) => (
        <rect
          key={h} data-handle={h}
          x={x - 4} y={y - 4} width={8} height={8}
          fill="var(--color-canvas)" stroke="var(--color-accent-saffron)" strokeWidth={1.5}
          style={{ cursor: `${h}-resize` }}
          onPointerDown={(e) => { e.stopPropagation(); onResizeStart(h, e); }}
        />
      ))}
    </g>
  );
}


// ---------- Helpers ----------

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  }
  // Quadratic Bezier through midpoints — gives a smooth, ink-like stroke.
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const next = points[i + 1];
    const mx = (p.x + next.x) / 2;
    const my = (p.y + next.y) / 2;
    d += ` Q${p.x},${p.y} ${mx},${my}`;
  }
  const last = points[points.length - 1];
  d += ` L${last.x},${last.y}`;
  return d;
}

function bboxOfShapes(shapes: Shape[]): { x: number; y: number; w: number; h: number } | null {
  if (shapes.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    let x = s.x, y = s.y, w = s.w, h = s.h;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function pointInPolygon(pt: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = (yi > pt.y) !== (yj > pt.y) &&
      pt.x < ((xj - xi) * (pt.y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function shapeInsidePolygon(s: Shape, poly: { x: number; y: number }[]): boolean {
  // Use a few representative points of the shape's bounding box / centroid.
  let x = s.x, y = s.y, w = s.w, h = s.h;
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  const samples = [
    { x: x + w / 2, y: y + h / 2 },
    { x, y },
    { x: x + w, y },
    { x, y: y + h },
    { x: x + w, y: y + h },
  ];
  // Require centroid + at least one corner inside (so partial brushes don't grab everything).
  const centroidIn = pointInPolygon(samples[0], poly);
  if (!centroidIn) return false;
  return samples.slice(1).some((p) => pointInPolygon(p, poly));
}
