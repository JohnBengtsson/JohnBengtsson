export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PillarSlug =
  | "body"
  | "mind"
  | "spirit"
  | "structure"
  | "leverage"
  | "agency";

export type PillarDomain = "health" | "wealth";
export type CampaignStatus = "active" | "paused" | "completed" | "archived";
export type CampaignPhase = "build" | "maintain";
export type TrackSlug = "leanness" | "look" | "strength";
export type LogType = "action" | "measurement" | "photo";
export type XpSource =
  | "daily_log"
  | "streak_bonus"
  | "level_up"
  | "manual"
  | "whoop_bonus";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: never[];
      };
      pillars: {
        Row: {
          id: number;
          slug: PillarSlug;
          domain: PillarDomain;
          label: string;
          description: string | null;
          sort_order: number;
        };
        Insert: {
          slug: PillarSlug;
          domain: PillarDomain;
          label: string;
          description?: string | null;
          sort_order?: number;
        };
        Update: {
          label?: string;
          description?: string | null;
          sort_order?: number;
        };
        Relationships: never[];
      };
      user_pillars: {
        Row: {
          id: string;
          user_id: string;
          pillar_id: number;
          level: number;
          xp_total: number;
          xp_current: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          pillar_id: number;
          level?: number;
          xp_total?: number;
          xp_current?: number;
        };
        Update: {
          level?: number;
          xp_total?: number;
          xp_current?: number;
          updated_at?: string;
        };
        Relationships: never[];
      };
      campaigns: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          slug: string;
          status: CampaignStatus;
          phase: CampaignPhase;
          composite_score: number;
          target_score: number;
          build_deadline: string | null;
          pillar_ids: number[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          title: string;
          slug: string;
          status?: CampaignStatus;
          phase?: CampaignPhase;
          composite_score?: number;
          target_score?: number;
          build_deadline?: string | null;
          pillar_ids?: number[];
        };
        Update: {
          status?: CampaignStatus;
          phase?: CampaignPhase;
          composite_score?: number;
          target_score?: number;
          build_deadline?: string | null;
          updated_at?: string;
        };
        Relationships: never[];
      };
      tracks: {
        Row: {
          id: string;
          campaign_id: string;
          slug: TrackSlug;
          label: string;
          weight: number;
          floor_value: number | null;
          target_value: number | null;
          current_value: number | null;
          unit: string | null;
          higher_is_better: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          campaign_id: string;
          slug: TrackSlug;
          label: string;
          weight?: number;
          floor_value?: number | null;
          target_value?: number | null;
          current_value?: number | null;
          unit?: string | null;
          higher_is_better?: boolean;
          sort_order?: number;
        };
        Update: {
          weight?: number;
          floor_value?: number | null;
          target_value?: number | null;
          current_value?: number | null;
          updated_at?: string;
        };
        Relationships: never[];
      };
      daily_logs: {
        Row: {
          id: string;
          user_id: string;
          campaign_id: string;
          log_date: string;
          log_type: LogType;
          pillar_slug: PillarSlug | null;
          track_slug: TrackSlug | null;
          action_key: string | null;
          value: number | null;
          notes: string | null;
          media_url: string | null;
          xp_awarded: number;
          logged_at: string;
        };
        Insert: {
          user_id: string;
          campaign_id: string;
          log_date: string;
          log_type?: LogType;
          pillar_slug?: PillarSlug | null;
          track_slug?: TrackSlug | null;
          action_key?: string | null;
          value?: number | null;
          notes?: string | null;
          media_url?: string | null;
          xp_awarded?: number;
        };
        Update: {
          value?: number | null;
          notes?: string | null;
          xp_awarded?: number;
        };
        Relationships: never[];
      };
      xp_transactions: {
        Row: {
          id: string;
          user_id: string;
          pillar_id: number | null;
          campaign_id: string | null;
          amount: number;
          source: XpSource;
          description: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          user_id: string;
          pillar_id?: number | null;
          campaign_id?: string | null;
          amount: number;
          source: XpSource;
          description?: string | null;
          metadata?: Json;
        };
        Update: never;
        Relationships: never[];
      };
      level_records: {
        Row: {
          id: string;
          user_id: string;
          pillar_id: number;
          level_reached: number;
          composite_at_levelup: number | null;
          evidence_log_ids: string[];
          leveled_at: string;
        };
        Insert: {
          user_id: string;
          pillar_id: number;
          level_reached: number;
          composite_at_levelup?: number | null;
          evidence_log_ids?: string[];
        };
        Update: never;
        Relationships: never[];
      };
      streaks: {
        Row: {
          id: string;
          user_id: string;
          campaign_id: string;
          current_streak: number;
          longest_streak: number;
          last_logged_date: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          campaign_id: string;
          current_streak?: number;
          longest_streak?: number;
          last_logged_date?: string | null;
        };
        Update: {
          current_streak?: number;
          longest_streak?: number;
          last_logged_date?: string | null;
          updated_at?: string;
        };
        Relationships: never[];
      };
      whoop_connections: {
        Row: {
          id: string;
          user_id: string;
          whoop_user_id: string;
          access_token: string;
          refresh_token: string;
          token_expires_at: string;
          connected_at: string;
          last_synced_at: string | null;
        };
        Insert: {
          user_id: string;
          whoop_user_id: string;
          access_token: string;
          refresh_token: string;
          token_expires_at: string;
        };
        Update: {
          access_token?: string;
          refresh_token?: string;
          token_expires_at?: string;
          last_synced_at?: string | null;
        };
        Relationships: never[];
      };
      whoop_data: {
        Row: {
          id: string;
          user_id: string;
          data_date: string;
          recovery_score: number | null;
          hrv_rmssd: number | null;
          resting_hr: number | null;
          sleep_score: number | null;
          sleep_duration_ms: number | null;
          strain_score: number | null;
          raw_payload: Json | null;
          synced_at: string;
        };
        Insert: {
          user_id: string;
          data_date: string;
          recovery_score?: number | null;
          hrv_rmssd?: number | null;
          resting_hr?: number | null;
          sleep_score?: number | null;
          sleep_duration_ms?: number | null;
          strain_score?: number | null;
          raw_payload?: Json | null;
        };
        Update: {
          recovery_score?: number | null;
          hrv_rmssd?: number | null;
          resting_hr?: number | null;
          sleep_score?: number | null;
          sleep_duration_ms?: number | null;
          strain_score?: number | null;
          raw_payload?: Json | null;
          synced_at?: string;
        };
        Relationships: never[];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
        };
        Update: never;
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: {
      award_xp: {
        Args: {
          p_user_id: string;
          p_pillar_id: number;
          p_amount: number;
          p_source: XpSource;
          p_campaign_id?: string;
          p_description?: string;
          p_metadata?: Json;
        };
        Returns: Array<{
          new_xp_total: number;
          new_level: number;
          leveled_up: boolean;
        }>;
      };
      tick_streak: {
        Args: {
          p_user_id: string;
          p_campaign_id: string;
          p_log_date: string;
        };
        Returns: Array<{
          streak: number;
          is_new_record: boolean;
        }>;
      };
      get_active_campaign_dashboard: {
        Args: { p_user_id: string };
        Returns: Json;
      };
    };
    Enums: {
      pillar_slug: PillarSlug;
      pillar_domain: PillarDomain;
      campaign_status: CampaignStatus;
      campaign_phase: CampaignPhase;
      track_slug: TrackSlug;
      log_type: LogType;
      xp_source: XpSource;
    };
  };
}
