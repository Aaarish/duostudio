import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginRequest, signupRequest, type User } from "./api";

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const USER_KEY = "auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch { return null; }
  });
  const qc = useQueryClient();

  const loginMutation = useMutation({ mutationFn: loginRequest });
  const signupMutation = useMutation({ mutationFn: signupRequest });

  const persist = (u: User, token: string) => {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    localStorage.setItem("auth_token", token);
    setUser(u);
  };

  const login = async (username: string, password: string) => {
    const res = await loginMutation.mutateAsync({ username, password });
    persist(res.user, res.token);
    qc.invalidateQueries();
  };
  const signup = async (email: string, username: string, password: string) => {
    const res = await signupMutation.mutateAsync({ email, username, password });
    persist(res.user, res.token);
    qc.invalidateQueries();
  };
  const logout = () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("auth_token");
    setUser(null);
    qc.clear();
  };

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_KEY) {
        setUser(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
