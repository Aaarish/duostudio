import axios from "axios";

/**
 * Centralized axios instance pointing at the Duostudio backend.
 * Override the base URL by setting `VITE_API_BASE_URL` in your `.env`.
 *
 * Defaults to `http://localhost:9191` to match the Postman collection.
 */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:9191";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  // Send the http-only `refresh_token` cookie on every request (required for
  // /auth/refresh to mint new access tokens).
  withCredentials: true,
});

// Attach access token from localStorage to every outgoing request.
api.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Call POST /auth/refresh to mint a new access token using the http-only
 * `refresh_token` cookie. Returns the new access token (and persists it).
 */
let refreshInFlight: Promise<string> | null = null;
export async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      // Bypass the request interceptor's stale Authorization header.
      const res = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true, headers: { "Content-Type": "application/json" } },
      );
      const token = extractToken(res.data);
      localStorage.setItem("auth_token", token);
      return token;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// On 401, try once to refresh the access token and replay the original request.
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error?.config as
      | (import("axios").InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error?.response?.status;
    const url: string = original?.url || "";
    const isAuthRoute = url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/refresh");
    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${token}`;
        return api.request(original);
      } catch {
        // Refresh failed — clear stale creds so the UI can prompt for login.
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
      }
    }
    return Promise.reject(error);
  },
);

// ----------------------------- Types ----------------------------------------
export type User = {
  id: string;
  /** Backend UUID for the user (used by /boards/users/{userId}). */
  userId?: string;
  username: string;
  email?: string;
  roles?: string[];
  createdAt?: string;
};

/** Backend board shape (matches POST/PUT body + GET response). */
export type BoardData = { shapes: unknown[]; notepadText?: string };
export type Scratchboard = {
  id: string;
  type?: string;
  boardData: BoardData;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  /** Optional title — backend may not provide one; UI falls back to id/type. */
  title?: string;
};


// ----------------------------- Helpers --------------------------------------
/** Decode a JWT payload (no signature verification — display only). */
export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function userFromToken(token: string): User {
  const p = decodeJwt(token) || {};
  const username = (p.sub as string) || (p.username as string) || "user";
  const userId =
    (p.userId as string) || (p.uid as string) || (p.id as string) || undefined;
  return {
    id: username,
    userId,
    username,
    roles: (p.roles as string[]) || [],
    createdAt: p.iat ? new Date((p.iat as number) * 1000).toISOString() : undefined,
  };
}

/** Normalise the various shapes a login endpoint may return into a raw token. */
function extractToken(data: unknown): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    return (d.token || d.accessToken || d.jwt || d.access_token) as string;
  }
  throw new Error("Login response did not contain a token");
}

/** Extract a backend user UUID from a login/register response body, if present. */
function extractUserId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  const direct = (d.userId || d.id || d.uid) as string | undefined;
  if (direct) return direct;
  const nested = d.user as Record<string, unknown> | undefined;
  return (nested?.id || nested?.userId || nested?.uid) as string | undefined;
}

async function resolveUserId(token: string, body: unknown): Promise<string | undefined> {
  const fromBody = extractUserId(body);
  if (fromBody) return fromBody;
  const fromJwt = userFromToken(token).userId;
  if (fromJwt) return fromJwt;
  // Last resort: try a /users/me endpoint. Silently ignore if it doesn't exist.
  try {
    const me = await api.get("/users/me", { headers: { Authorization: `Bearer ${token}` } });
    return extractUserId(me.data);
  } catch {
    return undefined;
  }
}

/* ===========================================================================
 * AUTH — POST /auth/register, POST /auth/login
 * =========================================================================*/
export async function loginRequest(payload: {
  username: string;
  password: string;
}) {
  const res = await api.post("/auth/login", payload);
  const token = extractToken(res.data);
  const user = userFromToken(token);
  user.userId = await resolveUserId(token, res.data);
  return { user, token };
}


export async function signupRequest(payload: {
  email: string;
  username: string;
  password: string;
}) {
  const res = await api.post("/auth/register", payload);
  // Some backends return a token on register; others require a follow-up login.
  let token: string;
  try {
    token = extractToken(res.data);
  } catch {
    const login = await api.post("/auth/login", {
      username: payload.username,
      password: payload.password,
    });
    token = extractToken(login.data);
  }
  const user = userFromToken(token);
  user.email = payload.email;
  user.userId = await resolveUserId(token, res.data);
  return { user, token };
}

/* ===========================================================================
 * BOARDS — /boards CRUD
 * =========================================================================*/
/** Fetch boards for a specific user via `GET /boards/users/{userId}`. */
export async function fetchBoardsRequest(userId?: string): Promise<Scratchboard[]> {
  const url = userId ? `/boards/users/${userId}` : "/boards";
  const res = await api.get(url);
  const data = res.data;
  const list: Scratchboard[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : Array.isArray(data?.boards)
        ? data.boards
        : [];
  return list;
}

export async function fetchBoardRequest(id: string): Promise<Scratchboard> {
  const res = await api.get(`/boards/${id}`);
  const data = res.data ?? {};
  // Some backends serialize `boardData` as a JSON string. Normalize to object.
  let boardData = data.boardData;
  if (typeof boardData === "string") {
    try { boardData = JSON.parse(boardData); } catch { boardData = { shapes: [] }; }
  }
  if (!boardData || typeof boardData !== "object") boardData = { shapes: [] };
  if (!Array.isArray(boardData.shapes)) boardData.shapes = [];
  return { ...data, boardData } as Scratchboard;
}

export async function createBoardRequest(payload: {
  type?: string;
  boardData?: BoardData;
}) {
  const body = {
    type: payload.type || "SELECT",
    boardData: payload.boardData || { shapes: [] },
  };
  const res = await api.post("/boards", body);
  return res.data as Scratchboard;
}

export async function updateBoardRequest(
  id: string,
  payload: { boardData: BoardData; version?: number; type?: string },
) {
  const res = await api.put(`/boards/${id}`, payload);
  return res.data as Scratchboard;
}


export async function deleteBoardRequest(id: string) {
  await api.delete(`/boards/${id}`);
  return { id };
}
