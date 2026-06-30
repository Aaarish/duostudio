import { useCallback, useReducer } from "react";
import { type BoardState, type Shape, type Mode, type Tool, createInitialBoard } from "./types";

type Action =
  | { type: "set_mode"; mode: Mode }
  | { type: "set_tool"; tool: Tool }
  | { type: "add_shape"; shape: Shape }
  | { type: "update_shape"; id: string; patch: Partial<Shape> }
  | { type: "select"; id: string | null }
  | { type: "delete_selected" }
  | { type: "clear" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "set_style"; patch: Partial<BoardState["style"]> }
  | { type: "replace_shapes"; shapes: Shape[] }
  | { type: "set_notepad"; text: string }
  | { type: "commit" }; // push current shapes to history

function pushHistory(state: BoardState): BoardState {
  return {
    ...state,
    history: [...state.history.slice(-49), state.shapes],
    future: [],
  };
}

function reducer(state: BoardState, action: Action): BoardState {
  switch (action.type) {
    case "set_mode": {
      const toolByMode: Record<Mode, Tool> = {
        select: "select",
        freestyle: "freestyle",
        text: "text",
        flowchart: "rectangle",
      };
      return { ...state, mode: action.mode, tool: toolByMode[action.mode], selectedId: null };
    }
    case "set_tool":
      return { ...state, tool: action.tool, selectedId: null };
    case "add_shape": {
      const next = pushHistory(state);
      return { ...next, shapes: [...state.shapes, action.shape], selectedId: action.shape.id };
    }
    case "update_shape": {
      return {
        ...state,
        shapes: state.shapes.map((s) =>
          s.id === action.id ? ({ ...s, ...action.patch } as Shape) : s
        ),
      };
    }
    case "commit":
      return pushHistory(state);
    case "select":
      return { ...state, selectedId: action.id };
    case "delete_selected": {
      if (!state.selectedId) return state;
      const next = pushHistory(state);
      return {
        ...next,
        shapes: state.shapes.filter((s) => s.id !== state.selectedId),
        selectedId: null,
      };
    }
    case "clear": {
      if (state.shapes.length === 0) return state;
      const next = pushHistory(state);
      return { ...next, shapes: [], selectedId: null };
    }
    case "undo": {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return {
        ...state,
        shapes: prev,
        history: state.history.slice(0, -1),
        future: [state.shapes, ...state.future].slice(0, 50),
        selectedId: null,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        shapes: next,
        history: [...state.history, state.shapes].slice(-50),
        future: rest,
        selectedId: null,
      };
    }
    case "set_style": {
      const style = { ...state.style, ...action.patch };
      let shapes = state.shapes;
      if (state.selectedId) {
        shapes = shapes.map((s) =>
          s.id === state.selectedId ? ({ ...s, ...action.patch } as Shape) : s
        );
      }
      return { ...state, style, shapes };
    }
    case "replace_shapes": {
      const next = pushHistory(state);
      return { ...next, shapes: action.shapes, selectedId: null };
    }
    case "set_notepad":
      return { ...state, notepadText: action.text };
  }
}

export function useBoard() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialBoard);

  const api = {
    state,
    setMode: useCallback((mode: Mode) => dispatch({ type: "set_mode", mode }), []),
    setTool: useCallback((tool: Tool) => dispatch({ type: "set_tool", tool }), []),
    addShape: useCallback((shape: Shape) => dispatch({ type: "add_shape", shape }), []),
    updateShape: useCallback(
      (id: string, patch: Partial<Shape>) => dispatch({ type: "update_shape", id, patch }),
      []
    ),
    commit: useCallback(() => dispatch({ type: "commit" }), []),
    select: useCallback((id: string | null) => dispatch({ type: "select", id }), []),
    deleteSelected: useCallback(() => dispatch({ type: "delete_selected" }), []),
    clear: useCallback(() => dispatch({ type: "clear" }), []),
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    redo: useCallback(() => dispatch({ type: "redo" }), []),
    setStyle: useCallback(
      (patch: Partial<BoardState["style"]>) => dispatch({ type: "set_style", patch }),
      []
    ),
    replaceShapes: useCallback((shapes: Shape[]) => dispatch({ type: "replace_shapes", shapes }), []),
    setNotepadText: useCallback((text: string) => dispatch({ type: "set_notepad", text }), []),
  };

  return api;
}

export type BoardApi = ReturnType<typeof useBoard>;
