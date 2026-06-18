import type { BoardApi } from "./useBoard";
import type { Tool, Mode } from "./types";
import { useState } from "react";
import {
  MousePointer2, Square, Circle, Diamond, Minus, ArrowRight,
  Pencil, Type, Undo2, Redo2, Trash2, Bold, Italic, StickyNote, ChevronDown, ChevronUp, Lasso, Hand,
} from "lucide-react";

interface Props {
  api: BoardApi;
  focused: boolean;
  onSpawnEditable?: (kind: "text" | "sticky") => void;
}

const panTool = { tool: "pan" as Tool, icon: Hand, label: "Pan", key: "H" };

const baseTools: { tool: Tool; icon: any; label: string; key: string }[] = [
  panTool,
  { tool: "select", icon: MousePointer2, label: "Select", key: "V" },
  { tool: "rectangle", icon: Square, label: "Rectangle", key: "R" },
  { tool: "ellipse", icon: Circle, label: "Ellipse", key: "O" },
  { tool: "diamond", icon: Diamond, label: "Diamond", key: "D" },
  { tool: "line", icon: Minus, label: "Line", key: "L" },
  { tool: "arrow", icon: ArrowRight, label: "Arrow", key: "A" },
  { tool: "freestyle", icon: Pencil, label: "Pen", key: "P" },
  { tool: "text", icon: Type, label: "Text", key: "T" },
  { tool: "sticky", icon: StickyNote, label: "Sticky", key: "N" },
];

// In freestyle mode, replace the "select" arrow with a lasso for circling drawings.
const freestyleTools: { tool: Tool; icon: any; label: string; key: string }[] = [
  panTool,
  { tool: "lasso", icon: Lasso, label: "Lasso", key: "S" },
  { tool: "freestyle", icon: Pencil, label: "Pen", key: "P" },
];

const modes: { mode: Mode; label: string; key: string }[] = [
  { mode: "select", label: "Select", key: "M" },
  { mode: "freestyle", label: "Freestyle", key: "F" },
  { mode: "text", label: "Text", key: "X" },
  { mode: "flowchart", label: "Flowchart", key: "C" },
];

const colors = [
  "oklch(0.18 0.02 250)",
  "oklch(0.55 0.22 25)",
  "oklch(0.72 0.18 55)",
  "oklch(0.55 0.18 145)",
  "oklch(0.5 0.2 260)",
  "oklch(0.6 0.05 80)",
];
const fills = [
  "transparent",
  "oklch(0.95 0.04 55)",
  "oklch(0.93 0.05 145)",
  "oklch(0.93 0.04 250)",
  "oklch(0.92 0.05 25)",
];

export function Toolbar({ api, focused, onSpawnEditable }: Props) {
  const { state, setTool, setMode, setStyle, undo, redo, clear, deleteSelected } = api;
  const [minimized, setMinimized] = useState(false);

  if (minimized) {
    return (
      <div className="glass-panel rounded-xl px-2 py-1.5 flex items-center gap-1">
        <button
          onClick={() => setTool("pan")}
          title="Pan (H)"
          className={`h-8 w-8 flex items-center justify-center rounded-md transition-all duration-150 active:scale-95 ${
            state.tool === "pan"
              ? "bg-[var(--color-accent-saffron)] text-background shadow-sm"
              : "hover:bg-muted text-foreground"
          }`}
        >
          <Hand className="h-4 w-4" />
        </button>
        <button onClick={() => setMinimized(false)} title="Expand toolbox" className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={`glass-panel rounded-xl p-2 flex flex-col gap-2 transition-opacity ${focused ? "opacity-100" : "opacity-60"}`}>
      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Toolbox</span>
        <button onClick={() => setMinimized(true)} title="Minimize" className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted">
          <ChevronUp className="h-3 w-3" />
        </button>
      </div>
      {/* Modes */}
      <div className="flex items-center gap-1 px-1">
        {modes.map((m) => (
          <button
            key={m.mode}
            onClick={() => setMode(m.mode)}
            title={`${m.label} mode (${m.key})`}
            className={`px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider transition-colors ${
              state.mode === m.mode
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="h-px bg-border" />

      {/* Tools */}
      <div className="grid grid-cols-4 gap-1">
        {(state.mode === "freestyle" ? freestyleTools : baseTools).map(({ tool, icon: Icon, label, key }) => (
          <button
            key={tool}
            onClick={() => {
              setTool(tool);
            }}
            title={`${label} (${key})`}
            className={`group relative h-9 w-9 flex items-center justify-center rounded-md transition-all duration-150 active:scale-95 ${
              state.tool === tool
                ? "bg-[var(--color-accent-saffron)] text-background shadow-sm"
                : "hover:bg-muted text-foreground hover:scale-105"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="absolute -bottom-1 -right-1 text-[8px] font-mono opacity-60">{key}</span>
          </button>
        ))}
      </div>

      <div className="h-px bg-border" />

      {/* Style */}
      <div className="px-1 space-y-2">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Stroke</div>
          <div className="flex gap-1">
            {colors.map((c) => (
              <button key={c} onClick={() => setStyle({ stroke: c })}
                className={`h-5 w-5 rounded-sm border ${state.style.stroke === c ? "ring-2 ring-[var(--color-accent-saffron)] ring-offset-1 ring-offset-card" : "border-border"}`}
                style={{ backgroundColor: c }} title="Stroke color" />
            ))}
          </div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Fill</div>
          <div className="flex gap-1">
            {fills.map((c) => (
              <button key={c} onClick={() => setStyle({ fill: c })}
                className={`h-5 w-5 rounded-sm border ${state.style.fill === c ? "ring-2 ring-[var(--color-accent-saffron)] ring-offset-1 ring-offset-card" : "border-border"}`}
                style={{
                  backgroundColor: c === "transparent" ? "transparent" : c,
                  backgroundImage: c === "transparent" ? "linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%)" : undefined,
                  backgroundSize: "6px 6px",
                  backgroundPosition: "0 0, 3px 3px",
                }}
                title="Fill color" />
            ))}
          </div>
        </div>

        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Stroke width</div>
          <input
            type="range" min={1} max={10} value={state.style.strokeWidth}
            onChange={(e) => setStyle({ strokeWidth: Number(e.target.value) })}
            className="w-full accent-[var(--color-accent-saffron)]"
          />
        </div>

        {(state.tool === "text" || state.mode === "text") && (
          <>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Font size</div>
              <input
                type="range" min={10} max={64} value={state.style.fontSize}
                onChange={(e) => setStyle({ fontSize: Number(e.target.value) })}
                className="w-full accent-[var(--color-accent-saffron)]"
              />
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setStyle({ fontWeight: state.style.fontWeight === 800 ? 400 : 800 })}
                className={`h-7 w-7 flex items-center justify-center rounded-md ${state.style.fontWeight === 800 ? "bg-foreground text-background" : "hover:bg-muted"}`}
                title="Bold (Cmd+B)"
              ><Bold className="h-3.5 w-3.5" /></button>
              <button
                onClick={() => setStyle({ italic: !state.style.italic })}
                className={`h-7 w-7 flex items-center justify-center rounded-md ${state.style.italic ? "bg-foreground text-background" : "hover:bg-muted"}`}
                title="Italic (Cmd+I)"
              ><Italic className="h-3.5 w-3.5" /></button>
            </div>
          </>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Actions */}
      <div className="flex gap-1">
        <button onClick={undo} title="Undo (Cmd+Z)" className="flex-1 h-8 rounded-md hover:bg-muted flex items-center justify-center"><Undo2 className="h-3.5 w-3.5" /></button>
        <button onClick={redo} title="Redo (Cmd+Shift+Z)" className="flex-1 h-8 rounded-md hover:bg-muted flex items-center justify-center"><Redo2 className="h-3.5 w-3.5" /></button>
        <button onClick={deleteSelected} title="Delete selection (Del)" className="flex-1 h-8 rounded-md hover:bg-muted flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <button onClick={clear} className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-destructive py-1">
        Clear board
      </button>
    </div>
  );
}
