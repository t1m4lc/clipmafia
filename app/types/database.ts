export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          stripe_customer_id: string | null;
          subscription_id: string | null;
          subscription_status:
            | "active"
            | "inactive"
            | "canceled"
            | "past_due"
            | "trialing";
          subscription_plan: "free" | "basic" | "pro";
          monthly_video_limit: number;
          videos_processed_this_month: number;
          billing_cycle_start: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          stripe_customer_id?: string | null;
          subscription_id?: string | null;
          subscription_status?:
            | "active"
            | "inactive"
            | "canceled"
            | "past_due"
            | "trialing";
          subscription_plan?: "free" | "basic" | "pro";
          monthly_video_limit?: number;
          videos_processed_this_month?: number;
          billing_cycle_start?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          stripe_customer_id?: string | null;
          subscription_id?: string | null;
          subscription_status?:
            | "active"
            | "inactive"
            | "canceled"
            | "past_due"
            | "trialing";
          subscription_plan?: "free" | "basic" | "pro";
          monthly_video_limit?: number;
          videos_processed_this_month?: number;
          billing_cycle_start?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      videos: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          original_filename: string;
          storage_path: string;
          duration: number | null;
          width: number | null;
          height: number | null;
          file_size: number | null;
          mime_type: string | null;
          thumbnail_path: string | null;
          transcript: TranscriptWord[] | null;
          status: "uploaded" | "processing" | "completed" | "failed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          original_filename: string;
          storage_path: string;
          duration?: number | null;
          width?: number | null;
          height?: number | null;
          file_size?: number | null;
          mime_type?: string | null;
          thumbnail_path?: string | null;
          transcript?: Json | null;
          status?: "uploaded" | "processing" | "completed" | "failed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          original_filename?: string;
          storage_path?: string;
          duration?: number | null;
          width?: number | null;
          height?: number | null;
          file_size?: number | null;
          mime_type?: string | null;
          thumbnail_path?: string | null;
          transcript?: Json | null;
          status?: "uploaded" | "processing" | "completed" | "failed";
          created_at?: string;
          updated_at?: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          video_id: string;
          user_id: string;
          status:
            | "queued"
            | "extracting_audio"
            | "transcribing"
            | "detecting_segments"
            | "processing_video"
            | "burning_subtitles"
            | "uploading"
            | "completed"
            | "failed";
          progress: number;
          error_message: string | null;
          failed_at_step: string | null;
          steps: Record<
            string,
            "pending" | "loading" | "done" | "error"
          > | null;
          subtitle_settings: SubtitleSettings | null;
          duration_option: 15 | 30 | 60;
          transcript: TranscriptWord[] | null;
          segments: Segment[] | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          user_id: string;
          status?: string;
          progress?: number;
          error_message?: string | null;
          failed_at_step?: string | null;
          steps?: Json | null;
          subtitle_settings?: Json | null;
          duration_option?: 15 | 30 | 60;
          transcript?: Json | null;
          segments?: Json | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          video_id?: string;
          user_id?: string;
          status?: string;
          progress?: number;
          error_message?: string | null;
          failed_at_step?: string | null;
          steps?: Json | null;
          subtitle_settings?: Json | null;
          duration_option?: 15 | 30 | 60;
          transcript?: Json | null;
          segments?: Json | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shorts: {
        Row: {
          id: string;
          job_id: string;
          video_id: string;
          user_id: string;
          title: string;
          storage_path: string;
          thumbnail_path: string | null;
          duration: number | null;
          start_time: number;
          end_time: number;
          score: number | null;
          width: number;
          height: number;
          file_size: number | null;
          has_subtitles: boolean;
          download_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          video_id: string;
          user_id: string;
          title: string;
          storage_path: string;
          thumbnail_path?: string | null;
          duration?: number | null;
          start_time: number;
          end_time: number;
          score?: number | null;
          width?: number;
          height?: number;
          file_size?: number | null;
          has_subtitles?: boolean;
          download_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          video_id?: string;
          user_id?: string;
          title?: string;
          storage_path?: string;
          thumbnail_path?: string | null;
          duration?: number | null;
          start_time?: number;
          end_time?: number;
          score?: number | null;
          width?: number;
          height?: number;
          file_size?: number | null;
          has_subtitles?: boolean;
          download_count?: number;
          created_at?: string;
        };
      };
    };
  };
}

// Shared types
export interface TranscriptWord {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface Segment {
  start: number;
  end: number;
  title: string;
  score: number;
}

export interface SubtitleSettings {
  fontName: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  bold: boolean;
  outline: number;
  shadow: number;
  marginV: number;
  alignment: number;
}

export type VideoStatus = "uploaded" | "processing" | "completed" | "failed";
export type JobStatus =
  | "queued"
  | "extracting_audio"
  | "transcribing"
  | "detecting_segments"
  | "processing_video"
  | "burning_subtitles"
  | "uploading"
  | "completed"
  | "failed";
export type SubscriptionPlan = "free" | "basic" | "pro";
export type SubscriptionStatus =
  | "active"
  | "inactive"
  | "canceled"
  | "past_due"
  | "trialing";
export type DurationOption = 15 | 30 | 60;
