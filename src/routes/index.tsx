import { createFileRoute, Link } from "@tanstack/react-router";
import { Skull, Users, Eye, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PARA — 3D Multiplayer Murder Mystery" },
      {
        name: "description",
        content:
          "PARA is a browser-based 3D multiplayer social deduction game. Investigate the mansion, find the killer, or eliminate everyone in silence.",
      },
      { property: "og:title", content: "PARA — Murder in the Mansion" },
      {
        property: "og:description",
        content: "4–12 players. One killer. A dark mansion. Find them before they find you.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden grain">
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-2">
          <Skull className="size-6 text-blood animate-flicker" />
          <span className="font-display text-xl tracking-[0.3em]">PARA</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost" size="sm">Sign in</Button>
        </Link>
      </header>

      <main className="relative z-10 px-6 md:px-10 pt-12 md:pt-24 pb-24 max-w-6xl mx-auto">
        <p className="text-xs uppercase tracking-[0.4em] text-blood mb-6">A multiplayer murder mystery</p>
        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] mb-6 max-w-3xl">
          One of you<br/>
          <span className="text-blood">is the killer.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10">
          4 to 12 players. A dim mansion. Complete your tasks, watch the halls, and vote out
          the murderer before the candles burn out.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link to="/auth">
            <Button size="lg" className="bg-blood hover:bg-blood/90 text-primary-foreground glow-blood h-12 px-8 text-base">
              Enter the mansion
            </Button>
          </Link>
          <a href="#how">
            <Button variant="outline" size="lg" className="h-12 px-8 text-base">
              How it plays
            </Button>
          </a>
        </div>

        <section id="how" className="mt-28 grid gap-6 md:grid-cols-3">
          <Feature icon={<Users className="size-5" />} title="Gather the suspects">
            Create a private room with a code, or join one from a friend. 4 to 12 players per match.
          </Feature>
          <Feature icon={<Eye className="size-5" />} title="Investigate">
            Detectives roam the mansion, complete repairs, and search for clues — quietly trying not to be next.
          </Feature>
          <Feature icon={<MessageSquareWarning className="size-5" />} title="Accuse">
            Find a body and call an emergency meeting. Debate, vote, and hope you're right.
          </Feature>
        </section>
      </main>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background to-transparent"
      />
    </div>
  );
}

function Feature({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-6">
      <div className="size-9 rounded-md bg-blood/15 text-blood flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-display text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
