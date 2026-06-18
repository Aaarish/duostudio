import { Outlet, Link, createRootRoute } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AuthModal, AutoAuthPrompt } from "@/components/AuthModal";
import { LayoutDashboard, LogIn, LogOut } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function AuthHeaderActions() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed top-3 right-3 z-40 flex items-center gap-2">
      {isAuthenticated ? (
        <>
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 rounded-md glass-panel px-3 py-1.5 text-xs font-mono uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            {user?.name?.split(" ")[0] ?? "Dashboard"}
          </Link>
          <button
            onClick={logout}
            title="Log out"
            className="flex items-center gap-1.5 rounded-md glass-panel px-3 py-1.5 text-xs font-mono uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-md glass-panel px-3 py-1.5 text-xs font-mono uppercase tracking-wider hover:bg-muted transition-colors"
          >
            <LogIn className="h-3.5 w-3.5" /> Sign in
          </button>
          <AuthModal open={open} onOpenChange={setOpen} />
        </>
      )}
    </div>
  );
}

function RootShell() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthHeaderActions />
        <AutoAuthPrompt delayMs={5000} />
        <Outlet />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export const Route = createRootRoute({
  component: RootShell,
  notFoundComponent: NotFoundComponent,
});
