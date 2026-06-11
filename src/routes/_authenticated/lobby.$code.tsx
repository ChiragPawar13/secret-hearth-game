import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skull, Copy, Crown, Check, LogOut } from "lucide-react";
import { toast } from "sonner";
import { leaveRoom, setReady, setPlayerColor } from "@/lib/game/rooms";
import { PLAYER_COLORS } from "@/lib/colors";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/lobby/$code")({
  component: LobbyPage,
});

type Room = Tables<"rooms">;
type Player = Tables<"room_players">;

function LobbyPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Load self
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Load room + players, subscribe to realtime
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: r, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code.toUpperCase())
        .maybeSingle();
      if (cancelled) return;
      if (error || !r) {
        toast.error("Room not found");
        navigate({ to: "/menu" });
        return;
      }
      setRoom(r);
      const { data: ps } = await supabase
        .from("room_players")
        .select("*")
        .eq("room_id", r.id)
        .order("joined_at", { ascending: true });
      if (!cancelled) {
        setPlayers(ps ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  useEffect(() => {
    if (!room) return;
    const channel = supabase
      .channel(`lobby-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${room.id}` },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === "INSERT") {
              const n = payload.new as Player;
              if (prev.find((p) => p.id === n.id)) return prev;
              return [...prev, n].sort(
                (a, b) => +new Date(a.joined_at) - +new Date(b.joined_at),
              );
            }
            if (payload.eventType === "UPDATE") {
              const n = payload.new as Player;
              return prev.map((p) => (p.id === n.id ? n : p));
            }
            if (payload.eventType === "DELETE") {
              const o = payload.old as Player;
              return prev.filter((p) => p.id !== o.id);
            }
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as Room),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room]);

  // Navigate to game when host starts
  useEffect(() => {
    if (room?.phase === "playing") {
      navigate({ to: "/game/$code", params: { code: room.code } });
    }
  }, [room?.phase, room?.code, navigate]);

  const me = useMemo(() => players.find((p) => p.user_id === userId) ?? null, [players, userId]);
  const isHost = userId && room?.host_id === userId;
  const usedColors = new Set(players.map((p) => p.color));
  const allReady = players.length >= 4 && players.every((p) => p.ready || p.user_id === room?.host_id);

  async function copyCode() {
    await navigator.clipboard.writeText(code.toUpperCase());
    toast.success("Code copied");
  }

  async function pickColor(c: string) {
    if (!room || !userId) return;
    if (usedColors.has(c) && me?.color !== c) return toast.error("Color taken");
    await setPlayerColor(room.id, userId, c);
  }

  async function toggleReady() {
    if (!room || !userId || !me) return;
    await setReady(room.id, userId, !me.ready);
  }

  async function exit() {
    if (!room || !userId) return;
    await leaveRoom(room.id, userId);
    navigate({ to: "/menu" });
  }

  async function startMatch() {
    if (!room || !isHost) return;
    if (players.length < 4) return toast.error("Need at least 4 players");
    // Assign roles
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const murdererId = shuffled[0].user_id;
    await Promise.all(
      players.map((p) =>
        supabase
          .from("room_players")
          .update({
            role: p.user_id === murdererId ? "murderer" : "detective",
            is_alive: true,
            tasks_done: 0,
            tasks_total: 4,
            pos_x: (Math.random() - 0.5) * 16,
            pos_z: (Math.random() - 0.5) * 16,
            rot_y: Math.random() * Math.PI * 2,
            ready: false,
          })
          .eq("id", p.id),
      ),
    );
    await supabase
      .from("rooms")
      .update({
        phase: "playing",
        started_at: new Date().toISOString(),
        task_total: players.filter((p) => p.user_id !== murdererId).length * 4,
        task_done: 0,
        winner: null,
      })
      .eq("id", room.id);
  }

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Entering the mansion…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen p-6 md:p-10 grain">
      <header className="flex items-center justify-between max-w-5xl mx-auto mb-8">
        <Link to="/menu" className="flex items-center gap-2">
          <Skull className="size-6 text-blood" />
          <span className="font-display text-xl tracking-[0.3em]">PARA</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={exit}>
          <LogOut className="size-4 mr-1.5" /> Leave
        </Button>
      </header>

      <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel p-6">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Room code</p>
              <button
                onClick={copyCode}
                className="group inline-flex items-center gap-3 mt-1"
                aria-label="Copy room code"
              >
                <span className="font-display text-4xl md:text-5xl tracking-[0.4em]">
                  {code.toUpperCase()}
                </span>
                <Copy className="size-5 text-muted-foreground group-hover:text-foreground transition" />
              </button>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Players</p>
              <p className="font-display text-2xl">
                {players.length}<span className="text-muted-foreground">/{room.max_players}</span>
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-secondary/40 border border-border"
              >
                <div
                  className="size-8 rounded-full border border-foreground/20 shrink-0"
                  style={{ background: p.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{p.display_name}</span>
                    {p.user_id === room.host_id && (
                      <Crown className="size-3.5 text-amber-400" aria-label="host" />
                    )}
                    {p.user_id === userId && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                  </div>
                </div>
                {p.user_id === room.host_id ? (
                  <span className="text-xs text-amber-400 uppercase tracking-widest">Host</span>
                ) : p.ready ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 uppercase tracking-widest">
                    <Check className="size-3.5" /> Ready
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground uppercase tracking-widest">
                    Waiting
                  </span>
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, room.max_players - players.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-dashed border-border/60 text-muted-foreground text-sm"
              >
                <div className="size-8 rounded-full border border-dashed border-border/60" />
                Empty seat
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="panel p-6">
            <h3 className="font-display text-xl mb-3">Your color</h3>
            <div className="grid grid-cols-6 gap-2">
              {PLAYER_COLORS.map((c) => {
                const taken = usedColors.has(c) && me?.color !== c;
                const mine = me?.color === c;
                return (
                  <button
                    key={c}
                    onClick={() => pickColor(c)}
                    disabled={taken}
                    aria-label={c}
                    className={`relative aspect-square rounded-md border-2 transition ${
                      mine
                        ? "border-foreground scale-105"
                        : taken
                          ? "border-transparent opacity-25 cursor-not-allowed"
                          : "border-transparent hover:border-foreground/40"
                    }`}
                    style={{ background: c }}
                  />
                );
              })}
            </div>
          </section>

          <section className="panel p-6">
            <h3 className="font-display text-xl mb-1">
              {isHost ? "Start the match" : "Ready up"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isHost
                ? `Minimum 4 players. ${players.length}/${room.max_players} in lobby.`
                : me?.ready
                  ? "You're ready. Waiting for the host…"
                  : "Mark yourself ready when you're set."}
            </p>

            {isHost ? (
              <Button
                onClick={startMatch}
                disabled={players.length < 4}
                className="w-full bg-blood hover:bg-blood/90 text-primary-foreground glow-blood h-11"
              >
                {players.length < 4 ? `Need ${4 - players.length} more` : "Begin the night"}
              </Button>
            ) : (
              <Button
                onClick={toggleReady}
                variant={me?.ready ? "outline" : "default"}
                className={
                  me?.ready
                    ? "w-full h-11"
                    : "w-full h-11 bg-blood hover:bg-blood/90 text-primary-foreground"
                }
              >
                {me?.ready ? "Cancel ready" : "I'm ready"}
              </Button>
            )}

            {!isHost && allReady && (
              <p className="mt-3 text-xs text-emerald-400">Everyone's ready. Waiting for host.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
