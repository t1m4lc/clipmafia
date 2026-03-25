export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      jobs: {
        Row: {
          clip_mode: string | null;
          completed_at: string | null;
          created_at: string | null;
          duration_option: number | null;
          error_message: string | null;
          failed_at_step: string | null;
          id: string;
          progress: number | null;
          segments: Json | null;
          started_at: string | null;
          status: string | null;
          steps: Json | null;
          subtitle_settings: Json | null;
          transcript: Json | null;
          updated_at: string | null;
          user_id: string;
          video_id: string;
        };
        Insert: {
          clip_mode?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          duration_option?: number | null;
          error_message?: string | null;
          failed_at_step?: string | null;
          id?: string;
          progress?: number | null;
          segments?: Json | null;
          started_at?: string | null;
          status?: string | null;
          steps?: Json | null;
          subtitle_settings?: Json | null;
          transcript?: Json | null;
          updated_at?: string | null;
          user_id: string;
          video_id: string;
        };
        Update: {
          clip_mode?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          duration_option?: number | null;
          error_message?: string | null;
          failed_at_step?: string | null;
          id?: string;
          progress?: number | null;
          segments?: Json | null;
          started_at?: string | null;
          status?: string | null;
          steps?: Json | null;
          subtitle_settings?: Json | null;
          transcript?: Json | null;
          updated_at?: string | null;
          user_id?: string;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_video_id_fkey";
            columns: ["video_id"];
            isOneToOne: false;
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_usage: {
        Row: {
          created_at: string | null;
          generations_count: number;
          id: string;
          month: string;
          updated_at: string | null;
          uploads_count: number;
          youtube_links_count: number;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          generations_count?: number;
          id?: string;
          month: string;
          updated_at?: string | null;
          uploads_count?: number;
          youtube_links_count?: number;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          generations_count?: number;
          id?: string;
          month?: string;
          updated_at?: string | null;
          uploads_count?: number;
          youtube_links_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monthly_usage_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          platform: string;
          credited: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          referrer_id: string;
          platform: string;
          credited?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          referrer_id?: string;
          platform?: string;
          credited?: boolean;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_id_fkey";
            columns: ["referrer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          billing_cycle_start: string | null;
          created_at: string | null;
          email: string;
          full_name: string | null;
          id: string;
          monthly_video_limit: number | null;
          stripe_customer_id: string | null;
          subscription_id: string | null;
          subscription_plan: string | null;
          subscription_status: string | null;
          upload_credits: number;
          referral_code: string | null;
          updated_at: string | null;
          videos_processed_this_month: number | null;
        };
        Insert: {
          avatar_url?: string | null;
          billing_cycle_start?: string | null;
          created_at?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          monthly_video_limit?: number | null;
          stripe_customer_id?: string | null;
          subscription_id?: string | null;
          subscription_plan?: string | null;
          subscription_status?: string | null;
          upload_credits?: number;
          referral_code?: string | null;
          updated_at?: string | null;
          videos_processed_this_month?: number | null;
        };
        Update: {
          avatar_url?: string | null;
          billing_cycle_start?: string | null;
          created_at?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          monthly_video_limit?: number | null;
          stripe_customer_id?: string | null;
          subscription_id?: string | null;
          subscription_plan?: string | null;
          subscription_status?: string | null;
          upload_credits?: number;
          referral_code?: string | null;
          updated_at?: string | null;
          videos_processed_this_month?: number | null;
        };
        Relationships: [];
      };
      shorts: {
        Row: {
          created_at: string | null;
          download_count: number | null;
          duration: number | null;
          end_time: number;
          file_size: number | null;
          has_subtitles: boolean | null;
          height: number | null;
          id: string;
          job_id: string;
          score: number | null;
          start_time: number;
          storage_path: string;
          thumbnail_path: string | null;
          title: string;
          user_id: string;
          video_id: string;
          width: number | null;
        };
        Insert: {
          created_at?: string | null;
          download_count?: number | null;
          duration?: number | null;
          end_time: number;
          file_size?: number | null;
          has_subtitles?: boolean | null;
          height?: number | null;
          id?: string;
          job_id: string;
          score?: number | null;
          start_time: number;
          storage_path: string;
          thumbnail_path?: string | null;
          title: string;
          user_id: string;
          video_id: string;
          width?: number | null;
        };
        Update: {
          created_at?: string | null;
          download_count?: number | null;
          duration?: number | null;
          end_time?: number;
          file_size?: number | null;
          has_subtitles?: boolean | null;
          height?: number | null;
          id?: string;
          job_id?: string;
          score?: number | null;
          start_time?: number;
          storage_path?: string;
          thumbnail_path?: string | null;
          title?: string;
          user_id?: string;
          video_id?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "shorts_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shorts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shorts_video_id_fkey";
            columns: ["video_id"];
            isOneToOne: false;
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
        ];
      };
      videos: {
        Row: {
          created_at: string | null;
          duration: number | null;
          file_size: number | null;
          height: number | null;
          id: string;
          mime_type: string | null;
          original_filename: string | null;
          source: string;
          source_url: string | null;
          youtube_metadata: Json | null;
          status: string | null;
          storage_path: string | null;
          thumbnail_path: string | null;
          title: string;
          transcript: Json | null;
          updated_at: string | null;
          user_id: string;
          width: number | null;
        };
        Insert: {
          created_at?: string | null;
          duration?: number | null;
          file_size?: number | null;
          height?: number | null;
          id?: string;
          mime_type?: string | null;
          original_filename?: string | null;
          source?: string;
          source_url?: string | null;
          youtube_metadata?: Json | null;
          status?: string | null;
          storage_path?: string | null;
          thumbnail_path?: string | null;
          title: string;
          transcript?: Json | null;
          updated_at?: string | null;
          user_id: string;
          width?: number | null;
        };
        Update: {
          created_at?: string | null;
          duration?: number | null;
          file_size?: number | null;
          height?: number | null;
          id?: string;
          mime_type?: string | null;
          original_filename?: string | null;
          source?: string;
          source_url?: string | null;
          youtube_metadata?: Json | null;
          status?: string | null;
          storage_path?: string | null;
          thumbnail_path?: string | null;
          title?: string;
          transcript?: Json | null;
          updated_at?: string | null;
          user_id?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "videos_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      reset_monthly_video_counts: { Args: never; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
