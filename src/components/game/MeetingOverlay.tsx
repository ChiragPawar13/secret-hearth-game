import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skull, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Player = Tables<"room_players">;
type Meeting = Tables<"meetings">;
type Vote = Tables<"votes">;

type Props = {
  meeting: Meeting;
  players: Player[];
  votes: Vote[];
  myUserId: string;
  isHost: boolean;
  onVote: (targetUserId: string | null) => void;
  onResolve: () => void;
  onContinue: () => void;
};

function timeLeft(iso: string) {
  return Math.max(0, Math.floor((+new Date(iso) - Date.now()) / 1000));
}

export function MeetingOverlay({
  meeting,
  players,
  votes,
  myUserId,
  isHost,
  onVote,
  onResolve,
  onContinue,
}: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  const phase = meeting.phase; // discussion | voting | result
  const me = players.find((p) => p.user_id === myUserId);
  const myVote = votes.find((v) => v.voter_id === myUserId);
  const isAlive = !!me?.is_alive;
  const body = players.find((p) => p.user_id === meeting.body_of);

  // Auto-advance discussion->voting in UI (the deadline drives behavior)
  const remainingDiscussion = timeLeft(meeting.discussion_ends_at);
  const remainingVoting = timeLeft(meeting.voting_ends_at);
  const inDiscussion = phase === "discussion" && remainingDiscussion > 0;
  const inVoting = phase !== "result" && !inDiscussion && remainingVoting > 0;
  const ended = phase === "result" || (!inDiscussion && !inVoting);

  // Host auto-resolves
  useEffect(() => {
    if (!isHost) return;
    if (phase !== "result" && !inDiscussion && !inVoting) {
      onResolve();
    }
  }, [isHost, phase, inDiscussion, inVoting, onResolve]);

  // Count votes per target
  const tally = new Map<string, number>();
  let skips = 0;
  for (const v of votes) {
    if (v.target_id) tally.set(v.target_id, (tally.get(v.target_id) ?? 0) + 1);
    else skips++;
  }

  const ejected =
    phase === "result" && meeting.ejected_user_id
      ? players.find((p) => p.user_id === meeting.ejected_user_id)
      : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md grid place-items-center p-4 overflow-auto">
      <div className="panel p-6 max-w-2xl w-full">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blood">Emergency meeting</p>
            <h2 className="font-display text-3xl">
              {body ? (
                <>
                  <span style={{ color: body.color }}>{body.display_name}</span> was found dead
                </>
              ) : (
                "Suspicion called"
              )}
            </h2>
          </div>
          <div className="text-right">
            {!ended && (
              <>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {inDiscussion ? "Discussion" : "Voting"}
                </p>
                <p className="font-display text-2xl">
                  {inDiscussion ? remainingDiscussion : remainingVoting}s
                </p>
              </>
            )}
          </div>
        </div>

        {ended ? (
          <div className="space-y-4">
            <div className="p-4 rounded-md bg-secondary/40 border border-border">
              {ejected ? (
                <p className="text-lg">
                  <span style={{ color: ejected.color }} className="font-semibold">
                    {ejected.display_name}
                  </span>{" "}
                  was ejected. They were{" "}
                  <span
                    className={
                      ejected.role === "murderer" ? "text-blood font-bold" : "text-muted-foreground"
                    }
                  >
                    {ejected.role === "murderer" ? "the murderer." : "innocent."}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  No one was ejected. The vote was skipped or tied.
                </p>
              )}
            </div>
            {isHost && (
              <Button
                onClick={onContinue}
                className="w-full bg-blood hover:bg-blood/90 text-primary-foreground h-11"
              >
                Continue
              </Button>
            )}
            {!isHost && (
              <p className="text-center text-sm text-muted-foreground">Waiting for host…</p>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {inDiscussion
                ? "Discuss. Who was where? Who was last with the body?"
                : isAlive
                  ? "Cast your vote. The most-voted player is ejected."
                  : "You are dead and cannot vote."}
            </p>

            <div className="space-y-2">
              {players
                .filter((p) => p.is_alive)
                .map((p) => {
                  const count = tally.get(p.user_id) ?? 0;
                  const isMine = myVote?.target_id === p.user_id;
                  return (
                    <button
                      key={p.id}
                      disabled={!inVoting || !isAlive}
                      onClick={() => onVote(p.user_id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border transition ${
                        isMine
                          ? "border-blood bg-blood/10"
                          : "border-border bg-secondary/30 hover:bg-secondary/60"
                      } ${!inVoting || !isAlive ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <div
                        className="size-8 rounded-full border border-foreground/20"
                        style={{ background: p.color }}
                      />
                      <span className="flex-1 text-left font-medium">
                        {p.display_name}
                        {p.user_id === myUserId && (
                          <span className="text-xs text-muted-foreground ml-1">(you)</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-sm">
                        {Array.from({ length: count }).map((_, i) => (
                          <Skull key={i} className="size-3.5 text-blood" />
                        ))}
                      </span>
                    </button>
                  );
                })}

              <button
                disabled={!inVoting || !isAlive}
                onClick={() => onVote(null)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border transition ${
                  myVote && myVote.target_id === null
                    ? "border-foreground bg-foreground/10"
                    : "border-border bg-secondary/30 hover:bg-secondary/60"
                } ${!inVoting || !isAlive ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <X className="size-5 text-muted-foreground" />
                <span className="flex-1 text-left">Skip vote</span>
                <span className="text-sm text-muted-foreground">{skips}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
