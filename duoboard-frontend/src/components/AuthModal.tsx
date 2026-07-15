import { useEffect, useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { extractApiError } from "@/lib/api";
import { Loader2 } from "lucide-react";

const emailSchema = z.string().trim().nonempty({ message: "Email cannot be empty" }).email({ message: "Invalid email address" }).max(255);
const usernameSchema = z.string().trim().nonempty({ message: "Username cannot be empty" }).min(3, { message: "Username must be at least 3 characters" }).max(50);
const passwordSchema = z.string().nonempty({ message: "Password cannot be empty" }).min(6, { message: "Password must be at least 6 characters" }).max(200);

const loginSchema = z.object({ username: usernameSchema, password: passwordSchema });
const signupSchema = z.object({ email: emailSchema, username: usernameSchema, password: passwordSchema });

type Mode = "login" | "signup";

export function AuthModal({
  open,
  onOpenChange,
  defaultMode = "login",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const schema = mode === "login" ? loginSchema : signupSchema;
    const parsed = schema.safeParse(
      mode === "login" ? { username, password } : { email, username, password },
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") await login(parsed.data.username, parsed.data.password);
      else {
        const d = parsed.data as { email: string; username: string; password: string };
        await signup(d.email, d.username, d.password);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      setError(extractApiError(err, "Something went wrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Sign in to access your scratchboards."
              : "Sign up to save your boards and sync across sessions."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 pt-2">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus={mode === "login"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={1} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Log in" : "Sign up"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {mode === "login" ? "No account? " : "Have an account? "}
            <button
              type="button"
              className="font-medium text-foreground hover:underline"
              onClick={() => { setError(null); setMode(mode === "login" ? "signup" : "login"); }}
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Auto-pops after `delayMs` if the user is not logged in and hasn't dismissed it. */
export function AutoAuthPrompt({ delayMs = 5000 }: { delayMs?: number }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isAuthenticated || dismissed) return;
    const timer = window.setTimeout(() => setOpen(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, dismissed, delayMs]);

  if (isAuthenticated) return null;
  return (
    <AuthModal
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) setDismissed(true); }}
    />
  );
}
