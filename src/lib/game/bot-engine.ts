// Local single-player bot engine — no networking, no Supabase.
// A finite state machine that owns: player transforms, roles, tasks, meetings, and votes.
// The route subscribes and drives the render loop.

import { resolveMove } from "@/lib/game/collision";
import { TASK_POSITIONS, VENT_POSITIONS, MANSION_BOUNDS } from "@/components/game/Mansion";

export type Phase = "playing" | "meeting" | "ended";
export type Role = "detective" | "murderer";

export type BotPlayer = {
  id: string;
  name: string;
  color: string;
  isHuman: boolean;
  role: Role;
  isAlive: boolean;
  x: number;
  z: number;
  rotY: number;
  tasksDone: number;
  tasksTotal: number;
  // Bot-only intent
  targetTaskId: string | null;
  taskWorkMs: number;
  killCooldownMs: number;
};

export type Body = { victimId: string; x: number; z: number };

export type Meeting = {
  bodyOfId: string | null; // null == emergency
  discussionEndsAt: number;
  votingEndsAt: number;
  phase: "discussion" | "voting" | "resolved";
  votes: Record<string, string | null | undefined>; // voterId -> targetId or null (skip)
  ejectedId?: string | null;
};

export type EngineState = {
  now: number;
  phase: Phase;
  players: BotPlayer[];
  bodies: Body[];
  meeting: Meeting | null;
  winner: "murderer" | "detectives" | null;
  humanId: string;
};

type Config = {
  botCount: number; // total bots (excluding player)
  humanIsMurderer: boolean;
  humanName: string;
  humanColor: string;
  tasksPerDetective: number;
};

const BOT_NAMES = [
  "Ada", "Vex", "Kai", "Mira", "Ryn", "Sable", "Onyx", "Juno", "Rook", "Nyx", "Cass", "Ezra",
];
const BOT_COLORS = [
  "#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ec4899",
  "#06b6d4", "#84cc16", "#f97316", "#6366f1", "#14b8a6", "#eab308",
];

const BOT_SPEED = 3.2;
const KILL_RANGE = 1.8;
const REPORT_RANGE = 2.2;
const TASK_RANGE = 1.6;
const KILL_COOLDOWN_MS = 22_000;
const TASK_WORK_MS = 6_000;
const DISCUSSION_MS = 25_000;
const VOTING_MS = 30_000;

type Listener = (s: EngineState) => void;

export class BotEngine {
  private state: EngineState;
  private listeners = new Set<Listener>();
  private raf: number | null = null;
  private last = 0;
  private cfg: Config;

  constructor(cfg: Config) {
    this.cfg = cfg;
    this.state = this.buildInitialState();
  }

  private buildInitialState(): EngineState {
    const { botCount, humanIsMurderer, humanName, humanColor, tasksPerDetective } = this.cfg;
    const usedColors = new Set<string>([humanColor]);
    const bots: BotPlayer[] = [];
    for (let i = 0; i < botCount; i++) {
      let color = BOT_COLORS[i % BOT_COLORS.length];
      let tries = 0;
      while (usedColors.has(color) && tries < 20) {
        color = BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)];
        tries++;
      }
      usedColors.add(color);
      bots.push({
        id: `bot-${i}`,
        name: BOT_NAMES[i % BOT_NAMES.length],
        color,
        isHuman: false,
        role: "detective", // assigned below
        isAlive: true,
        x: (Math.random() - 0.5) * 10,
        z: (Math.random() - 0.5) * 10,
        rotY: Math.random() * Math.PI * 2,
        tasksDone: 0,
        tasksTotal: tasksPerDetective,
        targetTaskId: null,
        taskWorkMs: 0,
        killCooldownMs: KILL_COOLDOWN_MS / 2,
      });
    }
    const human: BotPlayer = {
      id: "human",
      name: humanName,
      color: humanColor,
      isHuman: true,
      role: humanIsMurderer ? "murderer" : "detective",
      isAlive: true,
      x: 0,
      z: 0,
      rotY: 0,
      tasksDone: 0,
      tasksTotal: humanIsMurderer ? 0 : tasksPerDetective,
      targetTaskId: null,
      taskWorkMs: 0,
      killCooldownMs: KILL_COOLDOWN_MS,
    };
    // Assign murderer among bots if human is detective
    if (!humanIsMurderer && bots.length > 0) {
      const idx = Math.floor(Math.random() * bots.length);
      bots[idx].role = "murderer";
      bots[idx].tasksTotal = 0;
    }
    const players = [human, ...bots];
    return {
      now: performance.now(),
      phase: "playing",
      players,
      bodies: [],
      meeting: null,
      winner: null,
      humanId: "human",
    };
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    // Shallow copy so React sees a new reference
    const snap: EngineState = { ...this.state, players: this.state.players.map((p) => ({ ...p })) };
    this.listeners.forEach((l) => l(snap));
  }

  getState(): EngineState {
    return this.state;
  }

  start() {
    if (this.raf !== null) return;
    this.last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.state.now = t;
      this.tick(dt);
      this.emit();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  // ---- Actions from the human ----

  setHumanTransform(x: number, z: number, rotY: number) {
    const me = this.state.players.find((p) => p.id === "human");
    if (!me) return;
    me.x = x;
    me.z = z;
    me.rotY = rotY;
  }

  humanKill(): { ok: boolean; reason?: string } {
    const me = this.player("human");
    if (!me || me.role !== "murderer" || !me.isAlive) return { ok: false, reason: "Cannot kill" };
    if (me.killCooldownMs > 0) return { ok: false, reason: "Cooldown" };
    if (this.state.phase !== "playing") return { ok: false, reason: "Not in play" };
    const target = this.state.players.find(
      (p) =>
        p.id !== "human" &&
        p.isAlive &&
        p.role === "detective" &&
        dist(p, me) < KILL_RANGE,
    );
    if (!target) return { ok: false, reason: "No target in range" };
    this.killPlayer(target.id, me.x, me.z);
    me.killCooldownMs = KILL_COOLDOWN_MS;
    return { ok: true };
  }

  humanReport(): { ok: boolean; reason?: string } {
    const me = this.player("human");
    if (!me || !me.isAlive) return { ok: false, reason: "Cannot report" };
    if (this.state.phase !== "playing") return { ok: false, reason: "Not in play" };
    const body = this.state.bodies.find(
      (b) => Math.hypot(b.x - me.x, b.z - me.z) < REPORT_RANGE,
    );
    if (!body) return { ok: false, reason: "No body nearby" };
    this.startMeeting(body.victimId);
    return { ok: true };
  }

  humanNearestTask(): { id: string; label: string; color: string } | null {
    const me = this.player("human");
    if (!me || me.role !== "detective" || !me.isAlive) return null;
    if (me.tasksDone >= me.tasksTotal) return null;
    for (const t of TASK_POSITIONS) {
      if (Math.hypot(t.x - me.x, t.z - me.z) < TASK_RANGE) return t;
    }
    return null;
  }

  humanCompleteOneTask() {
    const me = this.player("human");
    if (!me) return;
    if (me.tasksDone < me.tasksTotal) me.tasksDone += 1;
    this.checkWinConditions();
  }

  humanTryVent(): boolean {
    const me = this.player("human");
    if (!me || me.role !== "murderer" || !me.isAlive) return false;
    const onIdx = VENT_POSITIONS.findIndex(
      (v) => Math.hypot(v.x - me.x, v.z - me.z) < 1.2,
    );
    if (onIdx < 0) return false;
    const next = VENT_POSITIONS[(onIdx + 1) % VENT_POSITIONS.length];
    me.x = next.x;
    me.z = next.z;
    return true;
  }

  humanVote(targetId: string | null) {
    if (!this.state.meeting || this.state.meeting.phase !== "voting") return;
    this.state.meeting.votes["human"] = targetId;
  }

  humanContinue() {
    // Only usable when meeting resolved
    if (!this.state.meeting || this.state.meeting.phase !== "resolved") return;
    this.state.meeting = null;
    this.state.phase = "ended" === this.state.phase ? "ended" : "playing";
    // Move players out of meeting cluster — simple: nudge slightly
    for (const p of this.state.players) {
      if (!p.isAlive) continue;
      p.x += (Math.random() - 0.5) * 2;
      p.z += (Math.random() - 0.5) * 2;
    }
    this.checkWinConditions();
  }

  // ---- Internals ----

  private player(id: string) {
    return this.state.players.find((p) => p.id === id);
  }

  private killPlayer(victimId: string, atX: number, atZ: number) {
    const v = this.player(victimId);
    if (!v) return;
    v.isAlive = false;
    v.x = atX + (Math.random() - 0.5) * 0.5;
    v.z = atZ + (Math.random() - 0.5) * 0.5;
    this.state.bodies.push({ victimId, x: v.x, z: v.z });
  }

  private startMeeting(bodyOfId: string | null) {
    // Remove reported body
    if (bodyOfId) {
      this.state.bodies = this.state.bodies.filter((b) => b.victimId !== bodyOfId);
    } else {
      // Emergency clears nothing
    }
    // Reset bot intents so they don't finish tasks mid-meeting
    for (const p of this.state.players) {
      if (!p.isHuman) {
        p.targetTaskId = null;
        p.taskWorkMs = 0;
      }
    }
    const now = this.state.now;
    this.state.phase = "meeting";
    this.state.meeting = {
      bodyOfId,
      discussionEndsAt: now + DISCUSSION_MS,
      votingEndsAt: now + DISCUSSION_MS + VOTING_MS,
      phase: "discussion",
      votes: {},
    };
    // Cluster players around center for the meeting visual
    let i = 0;
    const alive = this.state.players.filter((p) => p.isAlive);
    for (const p of alive) {
      const angle = (i / alive.length) * Math.PI * 2;
      p.x = Math.cos(angle) * 3;
      p.z = Math.sin(angle) * 3;
      p.rotY = angle + Math.PI;
      i++;
    }
  }

  private resolveMeeting() {
    const m = this.state.meeting;
    if (!m) return;
    // Tally
    const counts = new Map<string, number>();
    let skips = 0;
    for (const [, target] of Object.entries(m.votes)) {
      if (target === null || target === undefined) skips++;
      else counts.set(target, (counts.get(target) ?? 0) + 1);
    }
    // Bots that didn't vote count as skip
    const eligibleVoters = this.state.players.filter((p) => p.isAlive).length;
    const cast = Object.keys(m.votes).length;
    skips += Math.max(0, eligibleVoters - cast);
    let top: string | null = null;
    let topN = 0;
    let tie = false;
    for (const [id, n] of counts) {
      if (n > topN) {
        top = id;
        topN = n;
        tie = false;
      } else if (n === topN) {
        tie = true;
      }
    }
    let ejected: string | null = null;
    if (top && topN > skips && !tie) {
      ejected = top;
      const p = this.player(top);
      if (p) p.isAlive = false;
    }
    m.ejectedId = ejected;
    m.phase = "resolved";
  }

  private tick(dt: number) {
    if (this.state.phase === "ended") return;

    // Cool down murderer kill timer
    for (const p of this.state.players) {
      if (p.role === "murderer" && p.killCooldownMs > 0) {
        p.killCooldownMs = Math.max(0, p.killCooldownMs - dt * 1000);
      }
    }

    // Meeting tick
    if (this.state.phase === "meeting" && this.state.meeting) {
      const m = this.state.meeting;
      // Bots cast random votes shortly after voting begins
      if (m.phase === "discussion" && this.state.now >= m.discussionEndsAt) {
        m.phase = "voting";
        // Schedule bot vote intent — apply once
        for (const p of this.state.players) {
          if (p.isHuman || !p.isAlive) continue;
          const alive = this.state.players.filter((x) => x.isAlive && x.id !== p.id);
          if (p.role === "murderer") {
            // Murderer bot votes a random detective
            const targets = alive.filter((x) => x.role === "detective");
            if (targets.length > 0 && Math.random() < 0.85) {
              m.votes[p.id] = targets[Math.floor(Math.random() * targets.length)].id;
            } else {
              m.votes[p.id] = null;
            }
          } else {
            // Detective bot: 25% skip, else random alive suspect
            if (Math.random() < 0.25 || alive.length === 0) {
              m.votes[p.id] = null;
            } else {
              m.votes[p.id] = alive[Math.floor(Math.random() * alive.length)].id;
            }
          }
        }
      }
      if (m.phase === "voting" && this.state.now >= m.votingEndsAt) {
        this.resolveMeeting();
      }
      return;
    }

    // Playing — drive bots
    for (const p of this.state.players) {
      if (p.isHuman || !p.isAlive) continue;
      if (p.role === "detective") this.tickDetectiveBot(p, dt);
      else this.tickMurdererBot(p, dt);
    }

    this.checkWinConditions();
  }

  private moveToward(p: BotPlayer, tx: number, tz: number, dt: number): number {
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return 0;
    const step = Math.min(d, BOT_SPEED * dt);
    const nx = (dx / d) * step;
    const nz = (dz / d) * step;
    const resolved = resolveMove(p.x, p.z, nx, nz);
    p.x = clamp(resolved.x, -MANSION_BOUNDS + 1, MANSION_BOUNDS - 1);
    p.z = clamp(resolved.z, -MANSION_BOUNDS + 1, MANSION_BOUNDS - 1);
    p.rotY = Math.atan2(nx, nz);
    return d;
  }

  private tickDetectiveBot(p: BotPlayer, dt: number) {
    // If working on a task
    if (p.targetTaskId && p.taskWorkMs > 0) {
      p.taskWorkMs -= dt * 1000;
      if (p.taskWorkMs <= 0) {
        p.tasksDone = Math.min(p.tasksTotal, p.tasksDone + 1);
        p.targetTaskId = null;
      }
      return;
    }
    // Pick a task pad
    if (!p.targetTaskId) {
      if (p.tasksDone >= p.tasksTotal) {
        // Wander randomly
        const target = { x: (Math.random() - 0.5) * 24, z: (Math.random() - 0.5) * 24 };
        p.targetTaskId = `wander:${target.x.toFixed(2)},${target.z.toFixed(2)}`;
        p.taskWorkMs = 0;
        return;
      }
      const task = TASK_POSITIONS[Math.floor(Math.random() * TASK_POSITIONS.length)];
      p.targetTaskId = task.id;
    }
    if (p.targetTaskId.startsWith("wander:")) {
      const [, xz] = p.targetTaskId.split(":");
      const [tx, tz] = xz.split(",").map(Number);
      const remaining = this.moveToward(p, tx, tz, dt);
      if (remaining < 0.3) p.targetTaskId = null;
      return;
    }
    const t = TASK_POSITIONS.find((x) => x.id === p.targetTaskId);
    if (!t) {
      p.targetTaskId = null;
      return;
    }
    const remaining = this.moveToward(p, t.x, t.z, dt);
    if (remaining < TASK_RANGE) {
      p.taskWorkMs = TASK_WORK_MS + Math.random() * 2000;
    }
  }

  private tickMurdererBot(p: BotPlayer, dt: number) {
    // Find nearest alive detective
    const target = this.state.players
      .filter((x) => x.isAlive && x.role === "detective")
      .sort((a, b) => dist(a, p) - dist(b, p))[0];
    if (!target) return;
    const d = this.moveToward(p, target.x, target.z, dt);
    if (d < KILL_RANGE && p.killCooldownMs <= 0) {
      // Kill only if no other detective is close by (avoid witness) — simple heuristic
      const witnesses = this.state.players.filter(
        (x) =>
          x.isAlive &&
          x.id !== p.id &&
          x.id !== target.id &&
          x.role === "detective" &&
          dist(x, p) < 5,
      ).length;
      if (witnesses === 0 || Math.random() < 0.35) {
        this.killPlayer(target.id, p.x, p.z);
        p.killCooldownMs = KILL_COOLDOWN_MS;
      }
    }
  }

  private checkWinConditions() {
    if (this.state.phase === "ended" || this.state.winner) return;
    const detectives = this.state.players.filter((p) => p.role === "detective");
    const aliveDetectives = detectives.filter((p) => p.isAlive).length;
    const murderer = this.state.players.find((p) => p.role === "murderer");

    // Detectives win on tasks
    const totalNeeded = detectives.reduce((n, p) => n + p.tasksTotal, 0);
    const totalDone = detectives.reduce((n, p) => n + p.tasksDone, 0);
    if (totalNeeded > 0 && totalDone >= totalNeeded) {
      this.state.winner = "detectives";
      this.state.phase = "ended";
      return;
    }
    if (aliveDetectives === 0) {
      this.state.winner = "murderer";
      this.state.phase = "ended";
      return;
    }
    if (murderer && !murderer.isAlive) {
      this.state.winner = "detectives";
      this.state.phase = "ended";
    }
  }
}

function dist(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
