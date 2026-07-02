import { Button } from "@/components/ui/button";
import { Skull, Trophy } from "lucide-react";
import type { BotPlayer } from "@/lib/game/bot-engine";

type Props = {
  winner: "murderer" | "detectives";
  players: BotPlayer[];
  humanId: string;
  onExit: () => void;
  onPlayAgain: () => void;
};

export function BotEndOverlay({ winner, players, humanId, onExit, onPlayAgain }: Props) {
  const me = players.find((p) => p.id === humanId);
  const murderer = players.find((p) => p.role === "murderer");
  const iWon =
    (winner === "murderer" && me?.role === "murderer") ||
    (winner === "detectives" && me?.role === "detective");

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md grid place-items-center p-4">
      <div className="panel p-8 max-w-md w-full text-center">
        {iWon ? (
          <Trophy className="size-12 text-amber-400 mx-auto mb-3" />
        ) : (
          <Skull className="size-12 text-blood mx-auto mb-3 animate-flicker" />
        )}
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {iWon ? "Victory" : "Defeat"}
        </p>
        <h2 className="font-display text-4xl mb-2">
          {winner === "murderer" ? "The murderer prevails" : "The detectives win"}
        </h2>
        {murderer && (
          <p className="text-muted-foreground mb-6">
            The killer was{" "}
            <span style={{ color: murderer.color }} className="font-semibold">
              {murderer.name}
            </span>
            .
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={onPlayAgain} className="flex-1 h-11 bg-blood hover:bg-blood/90">
            Play again
          </Button>
          <Button onClick={onExit} variant="outline" className="flex-1 h-11">
            Menu
          </Button>
        </div>
      </div>
    </div>
  );
}
