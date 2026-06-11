
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Player',
  color TEXT NOT NULL DEFAULT '#ef4444',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'Player'),
    (ARRAY['#ef4444','#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1','#14b8a6','#eab308'])[1 + floor(random()*12)::int]
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Rooms
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase TEXT NOT NULL DEFAULT 'lobby', -- lobby | playing | meeting | ended
  winner TEXT, -- murderer | detectives | null
  max_players INT NOT NULL DEFAULT 8,
  task_total INT NOT NULL DEFAULT 0,
  task_done INT NOT NULL DEFAULT 0,
  current_meeting_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Room players
CREATE TABLE public.room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL,
  role TEXT, -- murderer | detective | null in lobby
  is_alive BOOLEAN NOT NULL DEFAULT true,
  ready BOOLEAN NOT NULL DEFAULT false,
  pos_x REAL NOT NULL DEFAULT 0,
  pos_z REAL NOT NULL DEFAULT 0,
  rot_y REAL NOT NULL DEFAULT 0,
  kill_cooldown_until TIMESTAMPTZ,
  tasks_done INT NOT NULL DEFAULT 0,
  tasks_total INT NOT NULL DEFAULT 0,
  body_reported BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_players TO authenticated;
GRANT ALL ON public.room_players TO service_role;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;

-- Helper function: is user in room?
CREATE OR REPLACE FUNCTION public.is_member_of_room(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_players WHERE room_id = _room_id AND user_id = _user_id);
$$;

-- Helper: is user host of room?
CREATE OR REPLACE FUNCTION public.is_host_of_room(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rooms WHERE id = _room_id AND host_id = _user_id);
$$;

-- Rooms policies
CREATE POLICY "rooms_select_visible" ON public.rooms FOR SELECT TO authenticated
USING (phase = 'lobby' OR public.is_member_of_room(id, auth.uid()));
CREATE POLICY "rooms_insert_self_host" ON public.rooms FOR INSERT TO authenticated
WITH CHECK (auth.uid() = host_id);
CREATE POLICY "rooms_update_host_or_member" ON public.rooms FOR UPDATE TO authenticated
USING (public.is_member_of_room(id, auth.uid()));
CREATE POLICY "rooms_delete_host" ON public.rooms FOR DELETE TO authenticated
USING (auth.uid() = host_id);

-- Room players policies
CREATE POLICY "room_players_select_member" ON public.room_players FOR SELECT TO authenticated
USING (public.is_member_of_room(room_id, auth.uid()));
CREATE POLICY "room_players_insert_self" ON public.room_players FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "room_players_update_self_or_host" ON public.room_players FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_host_of_room(room_id, auth.uid()));
CREATE POLICY "room_players_delete_self_or_host" ON public.room_players FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_host_of_room(room_id, auth.uid()));

-- Meetings
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  called_by UUID NOT NULL REFERENCES auth.users(id),
  body_of UUID REFERENCES auth.users(id),
  phase TEXT NOT NULL DEFAULT 'discussion', -- discussion | voting | ended
  discussion_ends_at TIMESTAMPTZ NOT NULL,
  voting_ends_at TIMESTAMPTZ NOT NULL,
  ejected_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_select_member" ON public.meetings FOR SELECT TO authenticated
USING (public.is_member_of_room(room_id, auth.uid()));
CREATE POLICY "meetings_insert_member" ON public.meetings FOR INSERT TO authenticated
WITH CHECK (public.is_member_of_room(room_id, auth.uid()));
CREATE POLICY "meetings_update_member" ON public.meetings FOR UPDATE TO authenticated
USING (public.is_member_of_room(room_id, auth.uid()));

-- Votes
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id),
  target_id UUID REFERENCES auth.users(id), -- null = skip
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, voter_id)
);
GRANT SELECT, INSERT ON public.votes TO authenticated;
GRANT ALL ON public.votes TO service_role;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_select_member" ON public.votes FOR SELECT TO authenticated
USING (public.is_member_of_room(room_id, auth.uid()));
CREATE POLICY "votes_insert_self" ON public.votes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = voter_id AND public.is_member_of_room(room_id, auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_players REPLICA IDENTITY FULL;
ALTER TABLE public.meetings REPLICA IDENTITY FULL;
ALTER TABLE public.votes REPLICA IDENTITY FULL;
