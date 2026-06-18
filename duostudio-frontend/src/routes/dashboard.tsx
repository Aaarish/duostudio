import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  fetchBoardsRequest,
  createBoardRequest,
  deleteBoardRequest,
  type Scratchboard,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, LogOut, ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!isAuthenticated) navigate({ to: "/" });
  }, [isAuthenticated, navigate]);

  const boardsQuery = useQuery({
    queryKey: ["boards", user?.id],
    queryFn: () => fetchBoardsRequest(user!.id),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: createBoardRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boards", user?.id] }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteBoardRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boards", user?.id] }),
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to studio
          </Link>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { logout(); navigate({ to: "/" }); }}>
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <section className="mb-10 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background text-xl font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-display text-2xl tracking-tight">{user.name}</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                joined {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-lg tracking-tight">Your scratchboards</h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {boardsQuery.data?.length ?? 0} total
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              createMutation.mutate({ userId: user.id, title: title.trim() });
              setTitle("");
            }}
            className="mb-4 flex gap-2"
          >
            <Input
              placeholder="New board title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button type="submit" disabled={createMutation.isPending || !title.trim()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </form>

          {boardsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : boardsQuery.data && boardsQuery.data.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {boardsQuery.data.map((b) => (
                <BoardCard
                  key={b.id}
                  board={b}
                  onDelete={() => deleteMutation.mutate(b.id)}
                  deleting={deleteMutation.isPending}
                />
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No saved boards yet. Create one above.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function BoardCard({
  board, onDelete, deleting,
}: { board: Scratchboard; onDelete: () => void; deleting: boolean }) {
  return (
    <li className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/30">
      <div>
        <p className="font-medium">{board.title}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          updated {new Date(board.updatedAt).toLocaleString()}
        </p>
      </div>
      <button
        onClick={onDelete}
        disabled={deleting}
        className="rounded p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
