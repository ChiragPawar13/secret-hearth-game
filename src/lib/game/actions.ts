import { supabase } from "@/integrations/supabase/client";

export const KILL_RANGE = 2.6;
export const REPORT_RANGE = 3.2;
export const TASK_RANGE = 1.8;
export const KILL_COOLDOWN_MS = 25_000;
export const DISCUSSION_MS = 25_000;
export const VOTING_MS = 30_000;
export const TASKS_PER_DETECTIVE = 4;

export async function killPlayer(opts: {
  roomId: string;
  killerId: string;
  targetPlayerId: string;
}) {
  const cooldown = new Date(Date.now() + KILL_COOLDOWN_MS).toISOString();
  // Mark target dead
  const { error: e1 } = await supabase
    .from("room_players")
    .update({ is_alive: false })
    .eq("id", opts.targetPlayerId);
  if (e1) throw e1;
  // Set cooldown on killer
  const { error: e2 } = await supabase
    .from("room_players")
    .update({ kill_cooldown_until: cooldown })
    .eq("room_id", opts.roomId)
    .eq("user_id", opts.killerId);
  if (e2) throw e2;
}

export async function startMeeting(opts: {
  roomId: string;
  calledBy: string;
  bodyOfUserId: string | null;
}) {
  const now = Date.now();
  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      room_id: opts.roomId,
      called_by: opts.calledBy,
      body_of: opts.bodyOfUserId,
      phase: "discussion",
      discussion_ends_at: new Date(now + DISCUSSION_MS).toISOString(),
      voting_ends_at: new Date(now + DISCUSSION_MS + VOTING_MS).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  // Mark body as reported if applicable
  if (opts.bodyOfUserId) {
    await supabase
      .from("room_players")
      .update({ body_reported: true })
      .eq("room_id", opts.roomId)
      .eq("user_id", opts.bodyOfUserId);
  }
  await supabase
    .from("rooms")
    .update({ phase: "meeting", current_meeting_id: meeting.id })
    .eq("id", opts.roomId);
  return meeting;
}

export async function castVote(opts: {
  roomId: string;
  meetingId: string;
  voterId: string;
  targetUserId: string | null; // null = skip
}) {
  // Remove any prior vote for this voter
  await supabase
    .from("votes")
    .delete()
    .eq("meeting_id", opts.meetingId)
    .eq("voter_id", opts.voterId);
  const { error } = await supabase.from("votes").insert({
    room_id: opts.roomId,
    meeting_id: opts.meetingId,
    voter_id: opts.voterId,
    target_id: opts.targetUserId,
  });
  if (error) throw error;
}

export async function resolveMeeting(opts: {
  roomId: string;
  meetingId: string;
}) {
  // Tally votes
  const { data: votes } = await supabase
    .from("votes")
    .select("target_id")
    .eq("meeting_id", opts.meetingId);
  const tally = new Map<string | null, number>();
  for (const v of votes ?? []) {
    tally.set(v.target_id, (tally.get(v.target_id) ?? 0) + 1);
  }
  let ejected: string | null = null;
  let max = 0;
  let tie = false;
  for (const [id, n] of tally.entries()) {
    if (id === null) continue;
    if (n > max) {
      max = n;
      ejected = id;
      tie = false;
    } else if (n === max) {
      tie = true;
    }
  }
  if (tie) ejected = null;

  await supabase
    .from("meetings")
    .update({ phase: "result", ejected_user_id: ejected })
    .eq("id", opts.meetingId);

  if (ejected) {
    await supabase
      .from("room_players")
      .update({ is_alive: false })
      .eq("room_id", opts.roomId)
      .eq("user_id", ejected);
  }
  return ejected;
}

export async function endMeetingAndResume(roomId: string) {
  await supabase
    .from("rooms")
    .update({ phase: "playing", current_meeting_id: null })
    .eq("id", roomId);
}

export async function completeOneTask(opts: {
  roomId: string;
  playerRowId: string;
  currentDone: number;
  currentTotal: number;
}) {
  if (opts.currentDone >= opts.currentTotal) return;
  await supabase
    .from("room_players")
    .update({ tasks_done: opts.currentDone + 1 })
    .eq("id", opts.playerRowId);
  // Increment global counter
  const { data: r } = await supabase
    .from("rooms")
    .select("task_done")
    .eq("id", opts.roomId)
    .maybeSingle();
  if (r) {
    await supabase
      .from("rooms")
      .update({ task_done: (r.task_done ?? 0) + 1 })
      .eq("id", opts.roomId);
  }
}

export async function endGame(opts: {
  roomId: string;
  winner: "murderer" | "detectives";
}) {
  await supabase
    .from("rooms")
    .update({ phase: "ended", winner: opts.winner, current_meeting_id: null })
    .eq("id", opts.roomId);
}

export async function updateMyTransform(opts: {
  playerRowId: string;
  x: number;
  z: number;
  rotY: number;
}) {
  // Persist occasionally; broadcast handles realtime.
  await supabase
    .from("room_players")
    .update({ pos_x: opts.x, pos_z: opts.z, rot_y: opts.rotY })
    .eq("id", opts.playerRowId);
}
