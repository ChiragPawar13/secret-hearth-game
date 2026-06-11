import { createFileRoute, Link } from "@tanstack/react-router";
import { Skull } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/game/$code")({
  component: GamePlaceholder,
});

function GamePlaceholder() {
  const { code } = Route.useParams();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 grain">
      <div className="panel p-10 max-w-lg text-center">
        <Skull className="size-10 text-blood mx-auto mb-4 animate-flicker" />
        <h1 className="font-display text-3xl mb-2">The mansion stirs…</h1>
        <p className="text-muted-foreground mb-6">
          You're in room <span className="font-mono tracking-[0.3em]">{code}</span>. The 3D world,
          movement, kill/report, meeting and voting arrive in the next iteration.
        </p>
        <Link to="/menu">
          <Button variant="outline">Back to menu</Button>
        </Link>
      </div>
    </div>
  );
}
