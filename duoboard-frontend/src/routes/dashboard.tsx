import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  fetchBoardsRequest,
  createBoardRequest,
  deleteBoardRequest,
  type Scratchboard,
  extractApiError,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, LogOut, ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const BOARD_TYPES = ["SELECT", "TEXT", "FREESTYLE", "FLOWCHART"] as const;

function DashboardPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [type, setType] = useState<string>("SELECT");

  useEffect(() => {
    if (!isAuthenticated) navigate({ to: "/" });
  }, [isAuthenticated, navigate]);

  const boardsQuery = useQuery({
    queryKey: ["boards", user?.userId ?? user?.username],
    queryFn: () => fetchBoardsRequest(user?.userId),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: createBoardRequest,
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: ["boards", user?.userId ?? user?.username] });
      // Open the freshly-created board in the studio (view 01 by default).
      if (board?.id) navigate({ to: "/", search: { boardId: board.id, view: "1" } });
    },
    onError: (err) => toast.error(extractApiError(err, "Failed to create board")),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteBoardRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boards", user?.userId ?? user?.username] }),
    onError: (err) => toast.error(extractApiError(err, "Failed to delete board"))
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
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-display text-2xl tracking-tight">{user.username}</h1>
              {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
              {user.roles && user.roles.length > 0 && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {user.roles.join(" · ")}
                </p>
              )}
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
              createMutation.mutate({ type, boardData: { shapes: [] } });
            }}
            className="mb-4 flex gap-2"
          >
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BOARD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create board
            </Button>
          </form>

          {boardsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : boardsQuery.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              Failed to load boards. Check that the backend is running at the configured API base URL.
            </div>
          ) : boardsQuery.data && boardsQuery.data.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {boardsQuery.data.map((b) => (
                <BoardCard
                  key={b.id}
                  board={b}
                  onOpenIn={(view) => navigate({ to: "/", search: { boardId: b.id, view } })}
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
  board, onOpenIn, onDelete, deleting,
}: { board: Scratchboard; onOpenIn: (view: "1" | "2") => void; onDelete: () => void; deleting: boolean }) {
  const shapeCount = board.boardData?.shapes?.length ?? 0;
  const title = board.title || `${board.type ?? "Board"} · ${board.id.slice(0, 8)}`;
  return (
    <li className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/30">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {shapeCount} shapes
          {board.updatedAt ? ` · updated ${new Date(board.updatedAt).toLocaleString()}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenIn("1")}
          title="Open in view 01 (left board)"
        >
          View 01
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenIn("2")}
          title="Open in view 02 (right board)"
        >
          View 02
        </Button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="rounded p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
