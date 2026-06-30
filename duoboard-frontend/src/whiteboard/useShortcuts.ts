import { useEffect } from "react";
import type { BoardApi } from "./useBoard";
import type { Tool, Mode } from "./types";

const TOOL_KEYS: Record<string, Tool> = {
  v: "select", r: "rectangle", o: "ellipse", d: "diamond",
  l: "line", a: "arrow", p: "freestyle", t: "text", n: "sticky", s: "lasso",
};
const MODE_KEYS: Record<string, Mode> = {
  m: "select", f: "freestyle", x: "text", c: "flowchart",
};

export function useShortcuts(
  boards: [BoardApi, BoardApi],
  focusedIndex: 0 | 1,
  setFocused: (i: 0 | 1) => void,
  onSpawnEditable?: (boardIndex: 0 | 1, kind: "text" | "sticky") => void,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      const api = boards[focusedIndex];
      const meta = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();

      if (k === "1") { setFocused(0); return; }
      if (k === "2") { setFocused(1); return; }

      if (meta && k === "z" && !e.shiftKey) { e.preventDefault(); api.undo(); return; }
      if (meta && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); api.redo(); return; }
      if (meta && k === "b") { e.preventDefault(); api.setStyle({ fontWeight: api.state.style.fontWeight === 800 ? 400 : 800 }); return; }
      if (meta && k === "i") { e.preventDefault(); api.setStyle({ italic: !api.state.style.italic }); return; }

      if (k === "delete" || k === "backspace") { api.deleteSelected(); return; }
      if (k === "escape") { api.select(null); api.setTool("select"); return; }

      if (e.shiftKey && MODE_KEYS[k]) { api.setMode(MODE_KEYS[k]); return; }
      if (TOOL_KEYS[k]) {
        const tool = TOOL_KEYS[k];
        api.setTool(tool);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boards, focusedIndex, setFocused, onSpawnEditable]);
}
