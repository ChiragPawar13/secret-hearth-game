export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      meetings: {
        Row: {
          body_of: string | null
          called_by: string
          created_at: string
          discussion_ends_at: string
          ejected_user_id: string | null
          id: string
          phase: string
          room_id: string
          voting_ends_at: string
        }
        Insert: {
          body_of?: string | null
          called_by: string
          created_at?: string
          discussion_ends_at: string
          ejected_user_id?: string | null
          id?: string
          phase?: string
          room_id: string
          voting_ends_at: string
        }
        Update: {
          body_of?: string | null
          called_by?: string
          created_at?: string
          discussion_ends_at?: string
          ejected_user_id?: string | null
          id?: string
          phase?: string
          room_id?: string
          voting_ends_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          color: string
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          color?: string
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          color?: string
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      room_players: {
        Row: {
          body_reported: boolean
          color: string
          display_name: string
          id: string
          is_alive: boolean
          joined_at: string
          kill_cooldown_until: string | null
          pos_x: number
          pos_z: number
          ready: boolean
          role: string | null
          room_id: string
          rot_y: number
          tasks_done: number
          tasks_total: number
          user_id: string
        }
        Insert: {
          body_reported?: boolean
          color: string
          display_name: string
          id?: string
          is_alive?: boolean
          joined_at?: string
          kill_cooldown_until?: string | null
          pos_x?: number
          pos_z?: number
          ready?: boolean
          role?: string | null
          room_id: string
          rot_y?: number
          tasks_done?: number
          tasks_total?: number
          user_id: string
        }
        Update: {
          body_reported?: boolean
          color?: string
          display_name?: string
          id?: string
          is_alive?: boolean
          joined_at?: string
          kill_cooldown_until?: string | null
          pos_x?: number
          pos_z?: number
          ready?: boolean
          role?: string | null
          room_id?: string
          rot_y?: number
          tasks_done?: number
          tasks_total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          current_meeting_id: string | null
          host_id: string
          id: string
          max_players: number
          phase: string
          started_at: string | null
          task_done: number
          task_total: number
          winner: string | null
        }
        Insert: {
          code: string
          created_at?: string
          current_meeting_id?: string | null
          host_id: string
          id?: string
          max_players?: number
          phase?: string
          started_at?: string | null
          task_done?: number
          task_total?: number
          winner?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          current_meeting_id?: string | null
          host_id?: string
          id?: string
          max_players?: number
          phase?: string
          started_at?: string | null
          task_done?: number
          task_total?: number
          winner?: string | null
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          room_id: string
          target_id: string | null
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          room_id: string
          target_id?: string | null
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          room_id?: string
          target_id?: string | null
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_host_of_room: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      is_member_of_room: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
