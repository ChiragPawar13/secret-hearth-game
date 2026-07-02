import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skull, X } from "lucide-react";
import type { BotPlayer, Meeting } from "@/lib/game/bot-engine";

type Props = {
  meeting: Meeting;
  players: BotPlayer[];
  humanId: string;
  now: number;
  onVote: (targetId: string | null) => void;
  onContinue: () => void;
};

export function BotMeetingOverlay({ meeting, players, humanId, now, onVote, onContinue }: Props) {
  const alive = players.filter((p) => p.isAlive);
  const me = players.find((p) => p.id === humanId);
  const isAlive = !!me?.isAlive;

  const inDiscussion = meeting.phase === "discussion";
  const inVoting = meeting.phase === "voting";
  const resolved = meeting.phase === "resolved";

  const secondsLeft = Math.max(
    0,
    Math.ceil(((inDiscussion ? meeting.discussionEndsAt : meeting.votingEndsAt) - now) / 1000),
  );

  const tallies = useMemo(() => {
    const map = new Map<string, number>();
    let skips = 0;
    for (const [, target] of Object.entries(meeting.votes)) {
      if (target === null || target === undefined) skips++;
      else map.set(target, (map.get(target) ?? 0) + 1);
    }
    return { map, skips };
  }, [meeting.votes]);

  const myVote = meeting.votes[humanId];
  const bodyVictim = meeting.bodyOfId ? players.find((p) => p.id === meeting.bodyOfId) : null;
  const ejected = resolved && meeting.ejectedId ? players.find((p) => p.id === meeting.ejectedId) : null;

  return (
    <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm grid place-items-center p-4">
      <div className="panel p-6 w-full max-w-lg">
        <div className="text-center mb-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            {inDiscussion ? "Discussion" : inVoting ? "Vote now" : "Verdict"}
          </p>
          <h2 className="font-display text-3xl">
            {bodyVictim ? (
              <>
                Body of{" "}
                <span style={{ color: bodyVictim.color }}>{bodyVictim.name}</span> found
              </>
            ) : (
              "Emergency meeting"
            )}
          </h2>
          {!resolved && (
            <p className="text-sm text-muted-foreground mt-1">{secondsLeft}s remaining</p>
          )}
        </div>

        {resolved ? (
          <div className="text-center space-y-4">
            {ejected ? (
              <p className="text-lg">
                <span style={{ color: ejected.color }} className="font-semibold">
                  {ejected.name}
                </span>{" "}
                was ejected. They were a{" "}
                <span className={ejected.role === "murderer" ? "text-blood" : "text-emerald-400"}>
                  {ejected.role}
                </span>
                .
              </p>
            ) : (
              <p className="text-lg text-muted-foreground">No one was ejected.</p>
            )}
            <Button onClick={onContinue} className="w-full h-11">
              Continue
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {alive.map((p) => {
              const n = tallies.map.get(p.id) ?? 0;
              const isMyVote = myVote === p.id;
              return (
                <button
                  key={p.id}
                  disabled={!inVoting || !isAlive || p.id === humanId}
                  onClick={() => onVote(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border transition ${
                    isMyVote
                      ? "border-foreground bg-foreground/10"
                      : "border-border bg-secondary/30 hover:bg-secondary/60"
                  } ${!inVoting || !isAlive || p.id === humanId ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div
                    className="size-5 rounded-full border border-foreground/30"
                    style={{ background: p.color }}
                  />
                  <span className="flex-1 text-left">
                    {p.name}
                    {p.id === humanId && <span className="text-xs text-muted-foreground"> (you)</span>}
                  </span>
                  <span className="text-sm text-muted-foreground">{n}</span>
                </button>
              );
            })}
            <button
              disabled={!inVoting || !isAlive}
              onClick={() => onVote(null)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border transition ${
                myVote === null && Object.prototype.hasOwnProperty.call(meeting.votes, humanId)
                  ? "border-foreground bg-foreground/10"
                  : "border-border bg-secondary/30 hover:bg-secondary/60"
              } ${!inVoting || !isAlive ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <X className="size-5 text-muted-foreground" />
              <span className="flex-1 text-left">Skip vote</span>
              <span className="text-sm text-muted-foreground">{tallies.skips}</span>
            </button>
          </div>
        )}

        {!isAlive && !resolved && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <Skull className="size-3.5" /> The dead cannot vote.
          </div>
        )}
      </div>
    </div>
  );
}
