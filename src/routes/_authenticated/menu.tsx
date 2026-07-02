import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skull, LogOut, Bot } from "lucide-react";
import { toast } from "sonner";
import { createRoom, joinRoomByCode } from "@/lib/game/rooms";
import { PLAYER_COLORS } from "@/lib/colors";

export const Route = createFileRoute("/_authenticated/menu")({
  component: MenuPage,
});

function MenuPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState<string>(PLAYER_COLORS[0]);
  const [code, setCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUser({ id: data.user.id });
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, color")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile) {
        setDisplayName(profile.display_name);
        if (PLAYER_COLORS.includes(profile.color as (typeof PLAYER_COLORS)[number])) {
          setColor(profile.color);
        }
      } else {
        setDisplayName(data.user.email?.split("@")[0] ?? "Player");
      }
    })();
  }, []);

  async function persistProfile() {
    if (!user) return;
    await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: displayName.trim() || "Player", color });
  }

  async function onCreate() {
    if (!user) return;
    setBusy(true);
    try {
      await persistProfile();
      const room = await createRoom({
        hostId: user.id,
        displayName: displayName.trim() || "Player",
        color,
        maxPlayers,
      });
      navigate({ to: "/lobby/$code", params: { code: room.code } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    if (!user) return;
    const c = code.trim().toUpperCase();
    if (c.length < 4) return toast.error("Enter a room code");
    setBusy(true);
    try {
      await persistProfile();
      const room = await joinRoomByCode({
        code: c,
        userId: user.id,
        displayName: displayName.trim() || "Player",
        color,
      });
      navigate({ to: "/lobby/$code", params: { code: room.code } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setBusy(false);
    }
  }

  async function onPlayBots() {
    if (!user) return;
    setBusy(true);
    try {
      await persistProfile();
      navigate({ to: "/game/bot" });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="relative min-h-screen p-6 md:p-10 grain">
      <header className="flex items-center justify-between max-w-5xl mx-auto mb-10">
        <Link to="/" className="flex items-center gap-2">
          <Skull className="size-6 text-blood" />
          <span className="font-display text-xl tracking-[0.3em]">PARA</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="size-4 mr-1.5" /> Sign out
        </Button>
      </header>

      <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Profile */}
        <section className="panel p-6">
          <h2 className="font-display text-2xl mb-4">Your character</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="grid grid-cols-6 gap-2">
                {PLAYER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Pick ${c}`}
                    className={`relative aspect-square rounded-md border-2 transition ${
                      color === c ? "border-foreground scale-105" : "border-transparent hover:border-foreground/40"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <div
                className="size-12 rounded-full border-2 border-foreground/20"
                style={{ background: color }}
              />
              <div>
                <div className="text-sm text-muted-foreground">Preview</div>
                <div className="font-medium">{displayName || "Player"}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Rooms */}
        <section className="space-y-6">
          <div className="panel p-6">
            <h2 className="font-display text-2xl mb-1">Create a room</h2>
            <p className="text-sm text-muted-foreground mb-4">
              You'll get a 5-character code to share with friends.
            </p>
            <div className="flex items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mp">Max players</Label>
                <Input
                  id="mp"
                  type="number"
                  min={4}
                  max={12}
                  value={maxPlayers}
                  onChange={(e) =>
                    setMaxPlayers(Math.max(4, Math.min(12, Number(e.target.value) || 8)))
                  }
                  className="w-24"
                />
              </div>
              <Button
                onClick={onCreate}
                disabled={busy}
                className="bg-blood hover:bg-blood/90 text-primary-foreground glow-blood"
              >
                Create room
              </Button>
            </div>
          </div>

          <div className="panel p-6">
            <h2 className="font-display text-2xl mb-1">Join a room</h2>
            <p className="text-sm text-muted-foreground mb-4">Enter the code your host shared.</p>
            <div className="flex items-end gap-3">
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="code">Room code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="A7K2X"
                  maxLength={6}
                  className="uppercase tracking-[0.4em] font-mono text-lg"
                />
              </div>
              <Button onClick={onJoin} disabled={busy} variant="outline">
                Join
              </Button>
            </div>
          </div>

          <div className="panel p-6 border-blood/40">
            <h2 className="font-display text-2xl mb-1 flex items-center gap-2">
              <Bot className="size-5 text-blood" /> Play with bots
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Solo practice against 5 AI opponents. No lobby, no waiting.
            </p>
            <Button
              onClick={onPlayBots}
              disabled={busy}
              className="w-full h-11 bg-blood hover:bg-blood/90 text-primary-foreground glow-blood"
            >
              Start solo match
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
