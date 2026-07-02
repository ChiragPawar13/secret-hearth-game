import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skull, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

import { Scene3D, mapToPlayerView, type RemoteTransform } from "@/components/game/Scene3D";
import { TASK_POSITIONS, VENT_POSITIONS } from "@/components/game/Mansion";
import { sfx } from "@/lib/game/sfx";
import { HUD } from "@/components/game/HUD";
import { MobileJoystick } from "@/components/game/MobileJoystick";
import { TaskMinigame } from "@/components/game/TaskMinigame";
import { MeetingOverlay } from "@/components/game/MeetingOverlay";
import { EndOverlay } from "@/components/game/EndOverlay";
import {
  KILL_RANGE,
  REPORT_RANGE,
  TASK_RANGE,
  TASKS_PER_DETECTIVE,
  killPlayer,
  startMeeting,
  castVote,
  resolveMeeting,
  endMeetingAndResume,
  completeOneTask,
  endGame,
  updateMyTransform,
} from "@/lib/game/actions";

export const Route = createFileRoute("/_authenticated/game/$code")({
  component: GamePage,
});

type Room = Tables<"rooms">;
type Player = Tables<"room_players">;
type Meeting = Tables<"meetings">;
type Vote = Tables<"votes">;

function dist2(ax: number, az: number, bx: number, bz: number) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function GamePage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [taskOpen, setTaskOpen] = useState<{ id: string; label: string; color: string } | null>(
    null,
  );
  const [now, setNow] = useState(Date.now());

  const remoteTransformsRef = useRef<Map<string, RemoteTransform>>(new Map());
  const inputRef = useRef({ x: 0, y: 0, sprint: false });
  const myPosRef = useRef({ x: 0, z: 0, rotY: 0 });
  const lastBroadcastRef = useRef(0);
  const lastPersistRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Auth + initial load
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: r } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code.toUpperCase())
        .maybeSingle();
      if (!r) {
        if (!cancelled) {
          toast.error("Room not found");
          navigate({ to: "/menu" });
        }
        return;
      }
      const { data: ps } = await supabase.from("room_players").select("*").eq("room_id", r.id);
      if (cancelled) return;
      setRoom(r);
      setPlayers(ps ?? []);
      if (r.current_meeting_id) {
        const { data: m } = await supabase
          .from("meetings")
          .select("*")
          .eq("id", r.current_meeting_id)
          .maybeSingle();
        setMeeting(m ?? null);
        if (m) {
          const { data: vs } = await supabase.from("votes").select("*").eq("meeting_id", m.id);
          setVotes(vs ?? []);
        }
      }
      // Initialize my position
      const { data: ud } = await supabase.auth.getUser();
      const me = ps?.find((p) => p.user_id === ud.user?.id);
      if (me) {
        myPosRef.current = { x: me.pos_x, z: me.pos_z, rotY: me.rot_y };
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  // Realtime: DB tables
  useEffect(() => {
    if (!room) return;
    const ch = supabase
      .channel(`game-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${room.id}` },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === "INSERT") return [...prev, payload.new as Player];
            if (payload.eventType === "UPDATE")
              return prev.map((p) => (p.id === (payload.new as Player).id ? (payload.new as Player) : p));
            if (payload.eventType === "DELETE")
              return prev.filter((p) => p.id !== (payload.old as Player).id);
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as Room),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetings", filter: `room_id=eq.${room.id}` },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            setMeeting(null);
            setVotes([]);
            return;
          }
          const m = payload.new as Meeting;
          setMeeting(m);
          // Load votes for new meeting
          if (payload.eventType === "INSERT") {
            setVotes([]);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${room.id}` },
        (payload) => {
          setVotes((prev) => {
            if (payload.eventType === "INSERT") return [...prev, payload.new as Vote];
            if (payload.eventType === "UPDATE")
              return prev.map((v) => (v.id === (payload.new as Vote).id ? (payload.new as Vote) : v));
            if (payload.eventType === "DELETE")
              return prev.filter((v) => v.id !== (payload.old as Vote).id);
            return prev;
          });
        },
      )
      .on("broadcast", { event: "pos" }, (payload) => {
        const { uid, x, z, rotY } = payload.payload as {
          uid: string;
          x: number;
          z: number;
          rotY: number;
        };
        if (uid === userId) return;
        remoteTransformsRef.current.set(uid, { x, z, rotY });
      })
      .subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [room?.id, userId]);

  // Tick clock for cooldown UI
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, []);

  // Broadcast + persist position
  useEffect(() => {
    if (!room || !userId) return;
    const i = setInterval(() => {
      const t = Date.now();
      if (channelRef.current && t - lastBroadcastRef.current > 100) {
        lastBroadcastRef.current = t;
        channelRef.current.send({
          type: "broadcast",
          event: "pos",
          payload: {
            uid: userId,
            x: myPosRef.current.x,
            z: myPosRef.current.z,
            rotY: myPosRef.current.rotY,
          },
        });
      }
      if (t - lastPersistRef.current > 5000) {
        lastPersistRef.current = t;
        const me = players.find((p) => p.user_id === userId);
        if (me) {
          updateMyTransform({
            playerRowId: me.id,
            x: myPosRef.current.x,
            z: myPosRef.current.z,
            rotY: myPosRef.current.rotY,
          }).catch(() => {});
        }
      }
    }, 80);
    return () => clearInterval(i);
  }, [room, userId, players]);

  // Keyboard input
  useEffect(() => {
    const keys = new Set<string>();
    function update() {
      let x = 0;
      let y = 0;
      if (keys.has("w") || keys.has("arrowup")) y += 1;
      if (keys.has("s") || keys.has("arrowdown")) y -= 1;
      if (keys.has("a") || keys.has("arrowleft")) x -= 1;
      if (keys.has("d") || keys.has("arrowright")) x += 1;
      inputRef.current.x = x;
      inputRef.current.y = y;
      inputRef.current.sprint = keys.has("shift");
    }
    function down(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      keys.add(k);
      update();
      sfx.unlock();
      if (k === "e") tryKill();
      if (k === "r") tryReport();
      if (k === "f") tryStartTask();
      if (k === "q") tryVent();
    }
    function up(e: KeyboardEvent) {
      keys.delete(e.key.toLowerCase());
      update();
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  // Derive game state
  const me = useMemo(() => players.find((p) => p.user_id === userId) ?? null, [players, userId]);
  const myRole = (me?.role ?? null) as "murderer" | "detective" | null;
  const isAlive = me?.is_alive ?? true;
  const isHost = !!room && !!userId && room.host_id === userId;
  const aliveDetectives = players.filter((p) => p.role === "detective" && p.is_alive).length;
  const totalDetectives = players.filter((p) => p.role === "detective").length;

  const killCooldownMs = me?.kill_cooldown_until ? +new Date(me.kill_cooldown_until) - now : 0;
  const killCooldownSec = Math.max(0, Math.ceil(killCooldownMs / 1000));

  const myPos = () => ({ x: myPosRef.current.x, z: myPosRef.current.z });

  // Nearest alive target for kill
  const killTarget = useMemo(() => {
    if (myRole !== "murderer" || !isAlive) return null;
    if (killCooldownSec > 0) return null;
    if (!me) return null;
    const mp = myPos();
    let best: Player | null = null;
    let bestD = KILL_RANGE * KILL_RANGE;
    for (const p of players) {
      if (p.user_id === userId) continue;
      if (!p.is_alive) continue;
      // Use latest known position (remote transform if any)
      const t = remoteTransformsRef.current.get(p.user_id);
      const px = t?.x ?? p.pos_x;
      const pz = t?.z ?? p.pos_z;
      const d = dist2(mp.x, mp.z, px, pz);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRole, isAlive, killCooldownSec, me, players, now, userId]);

  // Nearest dead body for report
  const reportBody = useMemo(() => {
    if (!isAlive) return null;
    const mp = myPos();
    let best: Player | null = null;
    let bestD = REPORT_RANGE * REPORT_RANGE;
    for (const p of players) {
      if (p.is_alive) continue;
      if (p.body_reported) continue;
      const d = dist2(mp.x, mp.z, p.pos_x, p.pos_z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAlive, players, now]);

  // Nearby task pad
  const nearbyTask = useMemo(() => {
    if (myRole !== "detective" || !isAlive) return null;
    if (!me) return null;
    if (me.tasks_done >= me.tasks_total) return null;
    const mp = myPos();
    for (const t of TASK_POSITIONS) {
      if (dist2(mp.x, mp.z, t.x, t.z) < TASK_RANGE * TASK_RANGE) return t;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRole, isAlive, me, now]);

  // Handlers
  async function tryKill() {
    if (!room || !userId || !killTarget) return;
    try {
      await killPlayer({ roomId: room.id, killerId: userId, targetPlayerId: killTarget.id });
      sfx.kill();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kill failed");
    }
  }
  async function tryReport() {
    if (!room || !userId || !reportBody) return;
    try {
      await startMeeting({
        roomId: room.id,
        calledBy: userId,
        bodyOfUserId: reportBody.user_id,
      });
      sfx.report();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Report failed");
    }
  }
  function tryStartTask() {
    if (!nearbyTask) return;
    setTaskOpen(nearbyTask);
  }

  // Vent teleport — murderer only, when standing on a vent grate.
  function tryVent() {
    if (!me || me.role !== "murderer" || !me.is_alive) return;
    const px = myPosRef.current.x;
    const pz = myPosRef.current.z;
    const onIdx = VENT_POSITIONS.findIndex(
      (v) => Math.hypot(v.x - px, v.z - pz) < 1.2,
    );
    if (onIdx < 0) {
      toast.info("Stand on a vent grate to escape");
      return;
    }
    const next = VENT_POSITIONS[(onIdx + 1) % VENT_POSITIONS.length];
    myPosRef.current.x = next.x;
    myPosRef.current.z = next.z;
    // Nudge the mesh directly if Scene3D exposes it; otherwise transform sync on next tick.
    window.dispatchEvent(
      new CustomEvent("para:teleport", { detail: { x: next.x, z: next.z } }),
    );
    sfx.vent();
  }

  async function onTaskComplete() {
    if (!room || !me || !taskOpen) return;
    setTaskOpen(null);
    await completeOneTask({
      roomId: room.id,
      playerRowId: me.id,
      currentDone: me.tasks_done,
      currentTotal: me.tasks_total,
    });
    sfx.taskDone();
    toast.success("Task complete");
  }

  async function onVote(target: string | null) {
    if (!room || !userId || !meeting) return;
    sfx.click();
    await castVote({
      roomId: room.id,
      meetingId: meeting.id,
      voterId: userId,
      targetUserId: target,
    });
  }

  async function onResolve() {
    if (!room || !meeting || !isHost) return;
    await resolveMeeting({ roomId: room.id, meetingId: meeting.id });
  }

  async function onContinue() {
    if (!room || !isHost) return;
    await endMeetingAndResume(room.id);
  }

  // Host: check win conditions
  useEffect(() => {
    if (!isHost || !room) return;
    if (room.phase === "ended") return;
    if (totalDetectives === 0) return;
    // Detectives win on tasks
    if (room.task_total > 0 && room.task_done >= room.task_total) {
      endGame({ roomId: room.id, winner: "detectives" }).catch(() => {});
      return;
    }
    // Murderer wins when all detectives dead
    if (aliveDetectives === 0) {
      endGame({ roomId: room.id, winner: "murderer" }).catch(() => {});
      return;
    }
    // Detectives win if murderer ejected (dead)
    const murderer = players.find((p) => p.role === "murderer");
    if (murderer && !murderer.is_alive) {
      endGame({ roomId: room.id, winner: "detectives" }).catch(() => {});
    }
  }, [isHost, room, aliveDetectives, totalDetectives, players]);

  // Detect touch
  const isTouch = useMemo(
    () => typeof window !== "undefined" && "ontouchstart" in window,
    [],
  );

  if (!room || !userId || !me) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Entering the mansion…
      </div>
    );
  }

  const playerViews = players.map(mapToPlayerView);
  const ended = room.phase === "ended" && room.winner;
  const inMeeting = room.phase === "meeting" && !!meeting;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <Scene3D
        players={playerViews}
        myUserId={userId}
        remoteTransformsRef={remoteTransformsRef}
        inputRef={inputRef}
        myPosRef={myPosRef}
        paused={inMeeting || !!taskOpen || !!ended}
      />

      <HUD
        role={myRole}
        isAlive={isAlive}
        myColor={me.color}
        myName={me.display_name}
        tasksDone={me.tasks_done}
        tasksTotal={me.tasks_total || TASKS_PER_DETECTIVE}
        globalTaskDone={room.task_done}
        globalTaskTotal={room.task_total}
        aliveCount={players.filter((p) => p.is_alive).length}
        totalCount={players.length}
        canKill={myRole === "murderer" && isAlive && killCooldownSec === 0 && !!killTarget}
        killCooldownSec={killCooldownSec}
        canReport={isAlive && !!reportBody}
        canDoTask={myRole === "detective" && isAlive ? nearbyTask : null}
        onKill={tryKill}
        onReport={tryReport}
        onStartTask={tryStartTask}
      />

      {/* Exit */}
      <div data-hud className="fixed top-4 right-1/2 translate-x-1/2 z-30 pointer-events-auto">
        <Link to="/menu" className="flex items-center gap-2 panel px-3 py-1.5 text-xs">
          <Skull className="size-3.5 text-blood" />
          <span className="font-display tracking-[0.3em]">PARA</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono tracking-widest">{code.toUpperCase()}</span>
        </Link>
      </div>

      {isTouch && (
        <MobileJoystick
          onMove={(v) => {
            inputRef.current.x = v.x;
            inputRef.current.y = -v.y;
          }}
        />
      )}

      {taskOpen && (
        <TaskMinigame
          label={taskOpen.label}
          color={taskOpen.color}
          onComplete={onTaskComplete}
          onCancel={() => setTaskOpen(null)}
        />
      )}

      {inMeeting && meeting && (
        <MeetingOverlay
          meeting={meeting}
          players={players}
          votes={votes}
          myUserId={userId}
          isHost={isHost}
          channel={channelRef.current}
          onVote={onVote}
          onResolve={onResolve}
          onContinue={onContinue}
        />
      )}

      {ended && (
        <EndOverlay
          winner={room.winner as "murderer" | "detectives"}
          players={players}
          myUserId={userId}
          onExit={async () => {
            navigate({ to: "/menu" });
          }}
        />
      )}

      {/* Role reveal toast at start */}
      <RoleReveal role={myRole} />

      {/* Desktop control hint */}
      {!isTouch && (
        <div
          data-hud
          className="fixed bottom-4 left-1/2 -translate-x-1/2 panel px-3 py-1.5 text-[11px] text-muted-foreground pointer-events-auto"
        >
          WASD move · Drag to look · E kill · R report · F task
        </div>
      )}
    </div>
  );
}

function RoleReveal({ role }: { role: "murderer" | "detective" | null }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    if (!role) return;
    const t = setTimeout(() => setShow(false), 3500);
    return () => clearTimeout(t);
  }, [role]);
  if (!role || !show) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/80 pointer-events-none">
      <div className="text-center animate-flicker">
        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">You are</p>
        <h1
          className={`font-display text-6xl md:text-7xl mt-2 ${
            role === "murderer" ? "text-blood" : "text-emerald-400"
          }`}
        >
          {role === "murderer" ? "THE MURDERER" : "A DETECTIVE"}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-md mx-auto">
          {role === "murderer"
            ? "Eliminate everyone before they uncover you."
            : "Finish the tasks or vote the killer out."}
        </p>
      </div>
    </div>
  );
}
