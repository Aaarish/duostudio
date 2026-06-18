import axios from "axios";

/**
 * Centralized axios instance. Swap `baseURL` for your real backend later.
 * All endpoints below are DUMMY — easily replaceable. They simulate latency
 * with a small delay and persist their "DB" in localStorage so the app
 * behaves like a real backend during development.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach token from localStorage to every outgoing request
api.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------- Dummy in-memory/localStorage backend ----------
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

type StoredUser = { id: string; email: string; name: string; password: string; createdAt: string };
export type User = Omit<StoredUser, "password">;
export type Scratchboard = {
  id: string;
  userId: string;
  title: string;
  updatedAt: string;
  preview?: string;
};

const USERS_KEY = "dummy_users";
const BOARDS_KEY = "dummy_boards";

function readUsers(): StoredUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); } catch { return []; }
}
function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
function readBoards(): Scratchboard[] {
  try { return JSON.parse(localStorage.getItem(BOARDS_KEY) || "[]"); } catch { return []; }
}
function writeBoards(boards: Scratchboard[]) {
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
}
function makeId() { return Math.random().toString(36).slice(2, 10); }
function strip(u: StoredUser): User { const { password: _p, ...rest } = u; return rest; }

function seedBoardsFor(userId: string) {
  const boards = readBoards();
  if (boards.some((b) => b.userId === userId)) return;
  const now = Date.now();
  const seeds: Scratchboard[] = [
    { id: makeId(), userId, title: "Welcome board", updatedAt: new Date(now - 1000 * 60 * 30).toISOString() },
    { id: makeId(), userId, title: "Sprint brainstorm", updatedAt: new Date(now - 1000 * 60 * 60 * 24).toISOString() },
    { id: makeId(), userId, title: "Wireframes draft", updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString() },
  ];
  writeBoards([...boards, ...seeds]);
}

/* ===========================================================================
 * AUTH — replace with real endpoints (e.g. api.post('/auth/login', ...))
 * =========================================================================*/
export async function loginRequest(payload: { email: string; password: string }) {
  await delay();
  const users = readUsers();
  const user = users.find((u) => u.email.toLowerCase() === payload.email.toLowerCase());
  if (!user || user.password !== payload.password) {
    throw new Error("Invalid email or password");
  }
  seedBoardsFor(user.id);
  return { user: strip(user), token: `dummy.${user.id}.${Date.now()}` };
}

export async function signupRequest(payload: { name: string; email: string; password: string }) {
  await delay();
  const users = readUsers();
  if (users.some((u) => u.email.toLowerCase() === payload.email.toLowerCase())) {
    throw new Error("An account with this email already exists");
  }
  const user: StoredUser = {
    id: makeId(),
    email: payload.email,
    name: payload.name,
    password: payload.password,
    createdAt: new Date().toISOString(),
  };
  writeUsers([...users, user]);
  seedBoardsFor(user.id);
  return { user: strip(user), token: `dummy.${user.id}.${Date.now()}` };
}

export async function meRequest(userId: string): Promise<User> {
  await delay(120);
  const user = readUsers().find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  return strip(user);
}

/* ===========================================================================
 * SCRATCHBOARDS — replace with real endpoints
 * =========================================================================*/
export async function fetchBoardsRequest(userId: string): Promise<Scratchboard[]> {
  await delay();
  return readBoards()
    .filter((b) => b.userId === userId)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function createBoardRequest(payload: { userId: string; title: string }) {
  await delay();
  const board: Scratchboard = {
    id: makeId(),
    userId: payload.userId,
    title: payload.title || "Untitled board",
    updatedAt: new Date().toISOString(),
  };
  writeBoards([...readBoards(), board]);
  return board;
}

export async function deleteBoardRequest(id: string) {
  await delay();
  writeBoards(readBoards().filter((b) => b.id !== id));
  return { id };
}
