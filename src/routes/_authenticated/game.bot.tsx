import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HUD } from "@/components/game/HUD";
import { Scene3D, type PlayerView, type RemoteTransform } from "@/components/game/Scene3D";
import { MobileJoystick } from "@/components/game/MobileJoystick";
import { TaskMinigame } from "@/components/game/TaskMinigame";
import { BotMeetingOverlay } from "@/components/game/BotMeetingOverlay";
import { BotEndOverlay } from "@/components/game/BotEndOverlay";
import { BotEngine, type EngineState } from "@/lib/game/bot-engine";
import { TASK_POSITIONS } from "@/components/game/Mansion";
import { sfx } from "@/lib/game/sfx";
import { PLAYER_COLORS } from "@/lib/colors";

export const Route = createFileRoute("/_authenticated/game/bot")({
  component: BotGamePage,
});

function BotGamePage() {
  const navigate = useNavigate();
  const [engine, setEngine] = useState<BotEngine | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [taskOpen, setTaskOpen] = useState<{ id: string; label: string; color: string } | null>(
    null,
  );
  const [seed, setSeed] = useState(0);

  const inputRef = useRef({ x: 0, y: 0, sprint: false });
  const myPosRef = useRef({ x: 0, z: 0, rotY: 0 });
  const remoteTransformsRef = useRef<Map<string, RemoteTransform>>(new Map());

  // Bootstrap engine — read the profile for name/color, roll dice on murderer role.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: ud } = await supabase.auth.getUser();
      const uid = ud.user?.id;
      let name = "You";
      let color: string = PLAYER_COLORS[0];
      if (uid) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, color")
          .eq("id", uid)
          .maybeSingle();
        if (profile) {
          name = profile.display_name;
          color = profile.color;
        }
      }
      if (cancelled) return;
      const humanIsMurderer = Math.random() < 0.28;
      const e = new BotEngine({
        botCount: 5,
        humanIsMurderer,
        humanName: name,
        humanColor: color,
        tasksPerDetective: 3,
      });
      const initial = e.getState();
      myPosRef.current = {
        x: initial.players.find((p) => p.isHuman)?.x ?? 0,
        z: initial.players.find((p) => p.isHuman)?.z ?? 0,
        rotY: 0,
      };
      setState(initial);
      setEngine(e);
    })();
    return () => {
      cancelled = true;
    };
  }, [seed]);

  // Drive engine + subscribe.
  useEffect(() => {
    if (!engine) return;
    const unsub = engine.subscribe((s) => {
      // Publish bot transforms into the ref map so Scene3D interpolates them.
      const now = performance.now();
      for (const p of s.players) {
        if (p.isHuman) continue;
        remoteTransformsRef.current.set(p.id, { x: p.x, z: p.z, rotY: p.rotY });
        // Scene3D reads timestamp via internal setter; write via a marker if needed later.
        void now;
      }
      setState(s);
    });
    engine.start();
    return () => {
      unsub();
      engine.stop();
    };
  }, [engine]);

  // Sync human transform back into the engine every frame via interval.
  useEffect(() => {
    if (!engine) return;
    const i = setInterval(() => {
      engine.setHumanTransform(myPosRef.current.x, myPosRef.current.z, myPosRef.current.rotY);
    }, 60);
    return () => clearInterval(i);
  }, [engine]);

  // Keyboard
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, state?.phase]);

  const me = state?.players.find((p) => p.isHuman) ?? null;
  const isPlaying = state?.phase === "playing";

  function tryKill() {
    if (!engine) return;
    const r = engine.humanKill();
    if (r.ok) sfx.kill();
    else if (r.reason && r.reason !== "Cannot kill" && r.reason !== "Not in play") {
      toast.info(r.reason);
    }
  }
  function tryReport() {
    if (!engine) return;
    const r = engine.humanReport();
    if (r.ok) sfx.report();
  }
  function tryStartTask() {
    if (!engine) return;
    const t = engine.humanNearestTask();
    if (t) setTaskOpen(t);
  }
  function tryVent() {
    if (!engine) return;
    if (engine.humanTryVent()) sfx.vent();
    else toast.info("Stand on a vent grate to escape");
  }
  function onTaskComplete() {
    if (!engine) return;
    engine.humanCompleteOneTask();
    sfx.taskDone();
    setTaskOpen(null);
    toast.success("Task complete");
  }

  // Meeting sfx trigger
  const lastMeetingSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (!state?.meeting) {
      lastMeetingSigRef.current = null;
      return;
    }
    const sig = `${state.meeting.discussionEndsAt}`;
    if (sig !== lastMeetingSigRef.current) {
      lastMeetingSigRef.current = sig;
      sfx.meetingStart();
    }
  }, [state?.meeting]);

  // Win/lose sting
  const endedStingRef = useRef(false);
  useEffect(() => {
    if (!state || state.phase !== "ended" || !state.winner || !me || endedStingRef.current) return;
    endedStingRef.current = true;
    const won =
      (state.winner === "murderer" && me.role === "murderer") ||
      (state.winner === "detectives" && me.role === "detective");
    if (won) sfx.win();
    else sfx.lose();
  }, [state, me]);

  const playerViews: PlayerView[] = useMemo(() => {
    if (!state) return [];
    return state.players.map((p) => ({
      id: p.id,
      userId: p.id,
      displayName: p.name,
      color: p.color,
      isAlive: p.isAlive,
      role: p.role,
      posX: p.x,
      posZ: p.z,
      rotY: p.rotY,
    }));
  }, [state]);

  const isTouch = useMemo(
    () => typeof window !== "undefined" && "ontouchstart" in window,
    [],
  );

  if (!state || !me || !engine) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Entering the mansion…
      </div>
    );
  }

  // HUD stats
  const detectives = state.players.filter((p) => p.role === "detective");
  const globalTaskDone = detectives.reduce((n, p) => n + p.tasksDone, 0);
  const globalTaskTotal = detectives.reduce((n, p) => n + p.tasksTotal, 0);
  const aliveCount = state.players.filter((p) => p.isAlive).length;
  const totalCount = state.players.length;

  // Can-kill: within range, cooldown 0, playing
  const nearestDetective = state.players
    .filter((p) => !p.isHuman && p.isAlive && p.role === "detective")
    .sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
  const killInRange =
    nearestDetective &&
    Math.hypot(nearestDetective.x - me.x, nearestDetective.z - me.z) < 1.8;
  const canKill = isPlaying && me.role === "murderer" && me.isAlive && me.killCooldownMs <= 0 && !!killInRange;
  const killCooldownSec = Math.ceil(me.killCooldownMs / 1000);

  // Can-report: body nearby
  const bodyNear = state.bodies.some(
    (b) => Math.hypot(b.x - me.x, b.z - me.z) < 2.2,
  );
  const canReport = isPlaying && me.isAlive && bodyNear;

  const nearbyTask = TASK_POSITIONS.find((t) => Math.hypot(t.x - me.x, t.z - me.z) < 1.6);
  const canDoTask =
    isPlaying && me.role === "detective" && me.isAlive && me.tasksDone < me.tasksTotal && nearbyTask
      ? nearbyTask
      : null;

  return (
    <div className="fixed inset-0 bg-black">
      <Scene3D
        players={playerViews}
        myUserId={me.id}
        remoteTransformsRef={remoteTransformsRef}
        inputRef={inputRef}
        myPosRef={myPosRef}
        paused={state.phase !== "playing"}
      />

      <HUD
        role={me.role}
        isAlive={me.isAlive}
        myColor={me.color}
        myName={me.name}
        tasksDone={me.tasksDone}
        tasksTotal={me.tasksTotal}
        globalTaskDone={globalTaskDone}
        globalTaskTotal={globalTaskTotal}
        aliveCount={aliveCount}
        totalCount={totalCount}
        canKill={canKill}
        killCooldownSec={killCooldownSec}
        canReport={canReport}
        canDoTask={canDoTask}
        onKill={tryKill}
        onReport={tryReport}
        onStartTask={tryStartTask}
      />

      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-20 panel px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground pointer-events-none">
        Solo · vs Bots
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

      {state.phase === "meeting" && state.meeting && (
        <BotMeetingOverlay
          meeting={state.meeting}
          players={state.players}
          humanId={me.id}
          now={state.now}
          onVote={(t) => engine.humanVote(t)}
          onContinue={() => engine.humanContinue()}
        />
      )}

      {state.phase === "ended" && state.winner && (
        <BotEndOverlay
          winner={state.winner}
          players={state.players}
          humanId={me.id}
          onExit={() => navigate({ to: "/menu" })}
          onPlayAgain={() => {
            endedStingRef.current = false;
            setState(null);
            setEngine(null);
            setSeed((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
