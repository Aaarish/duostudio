export type Tool =
  | "select"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "freestyle"
  | "lasso"
  | "text"
  | "sticky"
  | "pan";

export type Mode = "select" | "freestyle" | "text" | "flowchart";

export type ShapeKind =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "freestyle"
  | "text"
  | "sticky";

export interface BaseShape {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
}

export interface RectShape extends BaseShape { kind: "rectangle" }
export interface EllipseShape extends BaseShape { kind: "ellipse" }
export interface DiamondShape extends BaseShape { kind: "diamond" }
export interface LineShape extends BaseShape { kind: "line" }
export interface ArrowShape extends BaseShape { kind: "arrow" }
export interface FreestyleShape extends BaseShape {
  kind: "freestyle";
  points: { x: number; y: number }[];
}
export interface TextShape extends BaseShape {
  kind: "text";
  text: string;
  fontSize: number;
  fontWeight: 400 | 600 | 800;
  italic: boolean;
}
export interface StickyShape extends BaseShape {
  kind: "sticky";
  text: string;
  fontSize: number;
  fontWeight: 400 | 600 | 800;
  italic: boolean;
}

export type Shape =
  | RectShape
  | EllipseShape
  | DiamondShape
  | LineShape
  | ArrowShape
  | FreestyleShape
  | TextShape
  | StickyShape;

export interface BoardState {
  shapes: Shape[];
  selectedId: string | null;
  mode: Mode;
  tool: Tool;
  notepadText: string;
  history: Shape[][];
  future: Shape[][];
  style: {
    stroke: string;
    fill: string;
    strokeWidth: number;
    fontSize: number;
    fontWeight: 400 | 600 | 800;
    italic: boolean;
  };
}

export const DEFAULT_STYLE: BoardState["style"] = {
  stroke: "oklch(0.18 0.02 250)",
  fill: "transparent",
  strokeWidth: 2,
  fontSize: 18,
  fontWeight: 400,
  italic: false,
};

export const createInitialBoard = (): BoardState => ({
  shapes: [],
  selectedId: null,
  mode: "select",
  tool: "select",
  notepadText: "",
  history: [],
  future: [],
  style: { ...DEFAULT_STYLE },
});
