import { Button } from "@/components/ui/button";
import { Skull, Eye, ClipboardCheck, AlertTriangle } from "lucide-react";

type Props = {
  role: "murderer" | "detective" | null;
  isAlive: boolean;
  myColor: string;
  myName: string;
  tasksDone: number;
  tasksTotal: number;
  globalTaskDone: number;
  globalTaskTotal: number;
  aliveCount: number;
  totalCount: number;
  canKill: boolean;
  killCooldownSec: number;
  canReport: boolean;
  canDoTask: { id: string; label: string; color: string } | null;
  onKill: () => void;
  onReport: () => void;
  onStartTask: () => void;
};

export function HUD({
  role,
  isAlive,
  myColor,
  myName,
  tasksDone,
  tasksTotal,
  globalTaskDone,
  globalTaskTotal,
  aliveCount,
  totalCount,
  canKill,
  killCooldownSec,
  canReport,
  canDoTask,
  onKill,
  onReport,
  onStartTask,
}: Props) {
  return (
    <div data-hud className="pointer-events-none fixed inset-0 z-30">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 p-3 md:p-4 flex items-start justify-between gap-3">
        <div className="panel px-3 py-2 flex items-center gap-2 pointer-events-auto">
          <div
            className="size-6 rounded-full border border-foreground/30"
            style={{ background: myColor }}
          />
          <div className="leading-tight">
            <div className="text-sm font-medium">{myName}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {role === "murderer" ? (
                <span className="text-blood">Murderer</span>
              ) : (
                <span className="text-emerald-400">Detective</span>
              )}
              {!isAlive && <span className="ml-1">· Ghost</span>}
            </div>
          </div>
        </div>

        <div className="panel px-3 py-2 pointer-events-auto text-right">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Alive</div>
          <div className="font-display text-lg leading-none">
            {aliveCount}/{totalCount}
          </div>
        </div>
      </div>

      {/* Task progress bar */}
      {role !== "murderer" && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 panel px-3 py-2 pointer-events-auto w-[min(360px,80vw)]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="uppercase tracking-widest text-muted-foreground">Tasks</span>
            <span>
              {tasksDone}/{tasksTotal} · Crew {globalTaskDone}/{globalTaskTotal}
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all"
              style={{
                width: `${globalTaskTotal ? (globalTaskDone / globalTaskTotal) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Action buttons (right-bottom stack) */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-3 pointer-events-auto items-end">
        {role === "murderer" && (
          <Button
            disabled={!canKill}
            onClick={onKill}
            className={`h-16 w-16 rounded-full p-0 ${
              canKill
                ? "bg-blood hover:bg-blood/90 glow-blood animate-pulse-blood"
                : "bg-secondary"
            }`}
            aria-label="Kill"
          >
            <div className="flex flex-col items-center">
              <Skull className="size-6" />
              {killCooldownSec > 0 && <span className="text-[10px]">{killCooldownSec}s</span>}
            </div>
          </Button>
        )}
        <Button
          disabled={!canReport}
          onClick={onReport}
          className={`h-16 w-16 rounded-full p-0 ${
            canReport ? "bg-amber-500 hover:bg-amber-500/90" : "bg-secondary"
          }`}
          aria-label="Report"
        >
          <AlertTriangle className="size-6" />
        </Button>
        {role !== "murderer" && (
          <Button
            disabled={!canDoTask}
            onClick={onStartTask}
            className={`h-16 w-16 rounded-full p-0 ${
              canDoTask
                ? "bg-emerald-500 hover:bg-emerald-500/90"
                : "bg-secondary"
            }`}
            aria-label="Task"
          >
            <ClipboardCheck className="size-6" />
          </Button>
        )}
      </div>

      {/* Bottom-right contextual hint */}
      {canDoTask && (
        <div className="absolute bottom-28 right-6 panel px-3 py-1.5 text-xs pointer-events-auto">
          <span style={{ color: canDoTask.color }}>{canDoTask.label}</span> task ready
        </div>
      )}

      {!isAlive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 panel px-3 py-1.5 text-xs flex items-center gap-2 pointer-events-auto">
          <Eye className="size-3.5" /> Spectating — your team can still win.
        </div>
      )}
    </div>
  );
}
