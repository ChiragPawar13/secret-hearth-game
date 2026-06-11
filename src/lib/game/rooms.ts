import { supabase } from "@/integrations/supabase/client";
import { PLAYER_COLORS } from "@/lib/colors";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(len = 5): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export async function createRoom(opts: {
  hostId: string;
  displayName: string;
  color: string;
  maxPlayers: number;
}) {
  // Try a few codes in case of (very unlikely) collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({
        code,
        host_id: opts.hostId,
        max_players: opts.maxPlayers,
        phase: "lobby",
      })
      .select("*")
      .single();

    if (error) {
      // Unique violation -> retry
      if (error.code === "23505") continue;
      throw error;
    }

    const { error: joinErr } = await supabase.from("room_players").insert({
      room_id: room.id,
      user_id: opts.hostId,
      display_name: opts.displayName,
      color: opts.color,
    });
    if (joinErr) throw joinErr;

    return room;
  }
  throw new Error("Could not generate a unique room code");
}

export async function joinRoomByCode(opts: {
  code: string;
  userId: string;
  displayName: string;
  color: string;
}) {
  const code = opts.code.toUpperCase().trim();
  const { data: room, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error) throw error;
  if (!room) throw new Error("Room not found");
  if (room.phase !== "lobby") throw new Error("Match already in progress");

  // Check capacity
  const { count } = await supabase
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);
  if ((count ?? 0) >= room.max_players) throw new Error("Room is full");

  // Pick a color not already taken (best effort)
  const { data: existing } = await supabase
    .from("room_players")
    .select("color, user_id")
    .eq("room_id", room.id);

  const alreadyIn = existing?.some((p) => p.user_id === opts.userId);
  if (!alreadyIn) {
    const taken = new Set((existing ?? []).map((p) => p.color));
    const available = PLAYER_COLORS.find((c) => !taken.has(c)) ?? opts.color;
    const { error: insErr } = await supabase.from("room_players").insert({
      room_id: room.id,
      user_id: opts.userId,
      display_name: opts.displayName,
      color: available,
    });
    if (insErr) throw insErr;
  }
  return room;
}

export async function leaveRoom(roomId: string, userId: string) {
  await supabase
    .from("room_players")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);
}

export async function setReady(roomId: string, userId: string, ready: boolean) {
  await supabase
    .from("room_players")
    .update({ ready })
    .eq("room_id", roomId)
    .eq("user_id", userId);
}

export async function setPlayerColor(roomId: string, userId: string, color: string) {
  await supabase
    .from("room_players")
    .update({ color })
    .eq("room_id", roomId)
    .eq("user_id", userId);
}
