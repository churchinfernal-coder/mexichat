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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action_type: string
          admin_user_id: string
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          module_name: string
        }
        Insert: {
          action_type: string
          admin_user_id: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          module_name: string
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          module_name?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      call_sessions: {
        Row: {
          accepted_at: string | null
          call_type: string
          callee_id: string
          caller_id: string
          conversation_id: string | null
          created_at: string | null
          duration_seconds: number | null
          end_reason: string | null
          ended_at: string | null
          ended_by: string | null
          id: string
          initiated_at: string | null
          metadata: Json | null
          ringing_at: string | null
          room_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          call_type: string
          callee_id: string
          caller_id: string
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          initiated_at?: string | null
          metadata?: Json | null
          ringing_at?: string | null
          room_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          call_type?: string
          callee_id?: string
          caller_id?: string
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          initiated_at?: string | null
          metadata?: Json | null
          ringing_at?: string | null
          room_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_user_id: string
          created_at: string | null
          id: string
          nickname: string | null
          user_id: string
        }
        Insert: {
          contact_user_id: string
          created_at?: string | null
          id?: string
          nickname?: string | null
          user_id: string
        }
        Update: {
          contact_user_id?: string
          created_at?: string | null
          id?: string
          nickname?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          blocked_by: string | null
          created_at: string | null
          disappear_timer: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          status: string | null
          updated_at: string | null
          user_1: string
          user_2: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string | null
          disappear_timer?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_1: string
          user_2: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string | null
          disappear_timer?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_1?: string
          user_2?: string
        }
        Relationships: []
      }
      encryption_audit_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          device_id: string | null
          event: string
          id: string
          severity: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          device_id?: string | null
          event: string
          id?: string
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          device_id?: string | null
          event?: string
          id?: string
          severity?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      group_invites: {
        Row: {
          created_at: string | null
          created_by: string
          expires_at: string | null
          group_id: string
          id: string
          invite_code: string
          is_active: boolean | null
          max_uses: number | null
          use_count: number | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          group_id: string
          id?: string
          invite_code: string
          is_active?: boolean | null
          max_uses?: number | null
          use_count?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          invite_code?: string
          is_active?: boolean | null
          max_uses?: number | null
          use_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_join_requests: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_join_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          is_archived: boolean | null
          joined_at: string | null
          muted_until: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          is_archived?: boolean | null
          joined_at?: string | null
          muted_until?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          is_archived?: boolean | null
          joined_at?: string | null
          muted_until?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string | null
          expires_at: string | null
          group_id: string
          id: string
          iv: string | null
          media_type: string | null
          media_url: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          expires_at?: string | null
          group_id: string
          id?: string
          iv?: string | null
          media_type?: string | null
          media_url?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          expires_at?: string | null
          group_id?: string
          id?: string
          iv?: string | null
          media_type?: string | null
          media_url?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_read_receipts: {
        Row: {
          group_id: string | null
          id: string
          last_read_at: string | null
          user_id: string | null
        }
        Insert: {
          group_id?: string | null
          id?: string
          last_read_at?: string | null
          user_id?: string | null
        }
        Update: {
          group_id?: string | null
          id?: string
          last_read_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_read_receipts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          disappear_timer: string | null
          id: string
          invite_code: string | null
          is_private: boolean | null
          last_message: string | null
          last_message_at: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          disappear_timer?: string | null
          id?: string
          invite_code?: string | null
          is_private?: boolean | null
          last_message?: string | null
          last_message_at?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          disappear_timer?: string | null
          id?: string
          invite_code?: string | null
          is_private?: boolean | null
          last_message?: string | null
          last_message_at?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      key_recovery: {
        Row: {
          created_at: string | null
          id: string
          iv: string
          user_id: string
          wrapped_key: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          iv: string
          user_id: string
          wrapped_key: string
        }
        Update: {
          created_at?: string | null
          id?: string
          iv?: string
          user_id?: string
          wrapped_key?: string
        }
        Relationships: []
      }
      localization_strings: {
        Row: {
          category: string | null
          created_at: string
          id: string
          locale: string
          string_key: string
          translation: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          locale?: string
          string_key: string
          translation: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          locale?: string
          string_key?: string
          translation?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          message_table: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          message_table?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          message_table?: string | null
          user_id?: string
        }
        Relationships: []
      }
      module_registry: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          module_key: string
          module_name: string
          permissions: Json | null
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          module_key: string
          module_name: string
          permissions?: Json | null
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          module_key?: string
          module_name?: string
          permissions?: Json | null
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          id: string
          scope_id: string | null
          scope_type: string | null
          show_preview: boolean | null
          sound_enabled: boolean | null
          sound_name: string | null
          user_id: string
          vibrate: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          scope_id?: string | null
          scope_type?: string | null
          show_preview?: boolean | null
          sound_enabled?: boolean | null
          sound_name?: string | null
          user_id: string
          vibrate?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          scope_id?: string | null
          scope_type?: string | null
          show_preview?: boolean | null
          sound_enabled?: boolean | null
          sound_name?: string | null
          user_id?: string
          vibrate?: boolean | null
        }
        Relationships: []
      }
      pinned_messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          group_id: string | null
          id: string
          message_id: string
          message_table: string | null
          pinned_at: string | null
          pinned_by: string
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          group_id?: string | null
          id?: string
          message_id: string
          message_table?: string | null
          pinned_at?: string | null
          pinned_by: string
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          group_id?: string | null
          id?: string
          message_id?: string
          message_table?: string | null
          pinned_at?: string | null
          pinned_by?: string
        }
        Relationships: []
      }
      privacy_settings: {
        Row: {
          avatar_visibility: string | null
          created_at: string | null
          id: string
          last_seen_visibility: string | null
          online_visibility: string | null
          read_receipts: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_visibility?: string | null
          created_at?: string | null
          id?: string
          last_seen_visibility?: string | null
          online_visibility?: string | null
          read_receipts?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_visibility?: string | null
          created_at?: string | null
          id?: string
          last_seen_visibility?: string | null
          online_visibility?: string | null
          read_receipts?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      private_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          edited_at: string | null
          expires_at: string | null
          id: string
          is_forwarded: boolean | null
          is_read: boolean | null
          iv: string | null
          media_type: string | null
          media_url: string | null
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          is_forwarded?: boolean | null
          is_read?: boolean | null
          iv?: string | null
          media_type?: string | null
          media_url?: string | null
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          is_forwarded?: boolean | null
          is_read?: boolean | null
          iv?: string | null
          media_type?: string | null
          media_url?: string | null
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "private_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          agency_name: string | null
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          is_online: boolean | null
          language: string | null
          last_seen: string | null
          phone: string | null
          public_key: string | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          account_type?: string
          agency_name?: string | null
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_online?: boolean | null
          language?: string | null
          last_seen?: string | null
          phone?: string | null
          public_key?: string | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          account_type?: string
          agency_name?: string | null
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_online?: boolean | null
          language?: string | null
          last_seen?: string | null
          phone?: string | null
          public_key?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reported_users: {
        Row: {
          created_at: string | null
          details: string | null
          id: string
          reason: string
          reported_id: string
          reporter_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason: string
          reported_id: string
          reporter_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
          status?: string | null
        }
        Relationships: []
      }
      starred_messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          message_id: string
          message_table: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          message_id: string
          message_table?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          message_id?: string
          message_table?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      telemetry_events: {
        Row: {
          created_at: string | null
          event_name: string
          id: string
          metadata: Json | null
          session_id: string
        }
        Insert: {
          created_at?: string | null
          event_name: string
          id?: string
          metadata?: Json | null
          session_id: string
        }
        Update: {
          created_at?: string | null
          event_name?: string
          id?: string
          metadata?: Json | null
          session_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          created_at: string | null
          device_fingerprint: string | null
          device_id: string
          device_info: Json | null
          device_name: string | null
          device_type: string | null
          id: string
          is_active: boolean | null
          last_active: string | null
          os_version: string | null
          platform: string | null
          screen_resolution: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_fingerprint?: string | null
          device_id: string
          device_info?: Json | null
          device_name?: string | null
          device_type?: string | null
          id?: string
          is_active?: boolean | null
          last_active?: string | null
          os_version?: string | null
          platform?: string | null
          screen_resolution?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string | null
          device_id?: string
          device_info?: Json | null
          device_name?: string | null
          device_type?: string | null
          id?: string
          is_active?: boolean | null
          last_active?: string | null
          os_version?: string | null
          platform?: string | null
          screen_resolution?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_public_keys: {
        Row: {
          created_at: string | null
          fingerprint: string
          id: string
          public_key_jwk: string
          updated_at: string | null
          user_id: string
          version: number | null
        }
        Insert: {
          created_at?: string | null
          fingerprint: string
          id?: string
          public_key_jwk: string
          updated_at?: string | null
          user_id: string
          version?: number | null
        }
        Update: {
          created_at?: string | null
          fingerprint?: string
          id?: string
          public_key_jwk?: string
          updated_at?: string | null
          user_id?: string
          version?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_user_call: {
        Args: { p_callee_id: string; p_caller_id: string }
        Returns: Json
      }
      cleanup_expired_messages: { Args: never; Returns: number }
      get_my_call_history: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          call_session_id: string
          call_type: string
          direction: string
          duration_seconds: number
          end_reason: string
          initiated_at: string
          other_user_avatar: string
          other_user_id: string
          other_user_name: string
          status: string
        }[]
      }
      get_user_group_ids: { Args: { uid: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: string
          _user_id: string
        }
        Returns: boolean
      }
      is_user_in_call: { Args: { p_user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action_type: string
          p_changes?: Json
          p_entity_id?: string
          p_entity_type?: string
          p_metadata?: Json
          p_module_name: string
        }
        Returns: string
      }
    }
    Enums: {
      account_type: "user"
      app_role: "admin" | "user"
      call_end_reason:
        | "caller_hangup"
        | "callee_hangup"
        | "timeout"
        | "declined"
        | "busy"
        | "network_error"
        | "permission_denied"
        | "blocked_user"
        | "system"
      call_status:
        | "initiated"
        | "ringing"
        | "accepted"
        | "in_progress"
        | "on_hold"
        | "reconnecting"
        | "ended"
        | "missed"
        | "declined"
        | "busy"
        | "failed"
      call_type: "audio" | "video"
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
    Enums: {
      account_type: ["user"],
      app_role: ["admin", "user"],
      call_end_reason: [
        "caller_hangup",
        "callee_hangup",
        "timeout",
        "declined",
        "busy",
        "network_error",
        "permission_denied",
        "blocked_user",
        "system",
      ],
      call_status: [
        "initiated",
        "ringing",
        "accepted",
        "in_progress",
        "on_hold",
        "reconnecting",
        "ended",
        "missed",
        "declined",
        "busy",
        "failed",
      ],
      call_type: ["audio", "video"],
    },
  },
} as const
