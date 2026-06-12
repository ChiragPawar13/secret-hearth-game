import { Button } from "@/components/ui/button";
import { Skull, Trophy } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Props = {
  winner: "murderer" | "detectives";
  players: Tables<"room_players">[];
  myUserId: string;
  onExit: () => void;
};

export function EndOverlay({ winner, players, myUserId, onExit }: Props) {
  const me = players.find((p) => p.user_id === myUserId);
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
              {murderer.display_name}
            </span>
            .
          </p>
        )}
        <Button onClick={onExit} className="w-full h-11">
          Back to menu
        </Button>
      </div>
    </div>
  );
}
