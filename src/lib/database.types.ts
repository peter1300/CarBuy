export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          email: string
          account_type: 'personal' | 'business'
          company_name: string | null
          seller_status: 'online' | 'busy' | 'offline'
          rating: number
          response_time: string
          created_at: string
          updated_at: string
          avatar_url: string | null
          phone: string | null
        }
        Insert: {
          id: string
          name: string
          email: string
          account_type: 'personal' | 'business'
          company_name?: string | null
          seller_status?: 'online' | 'busy' | 'offline'
          rating?: number
          response_time?: string
          created_at?: string
          updated_at?: string
          avatar_url?: string | null
          phone?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string
          account_type?: 'personal' | 'business'
          company_name?: string | null
          seller_status?: 'online' | 'busy' | 'offline'
          rating?: number
          response_time?: string
          created_at?: string
          updated_at?: string
          avatar_url?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      listings: {
        Row: {
          id: string
          owner_id: string | null
          is_demo: boolean
          title: string
          make: string
          model: string
          year: number
          price: number
          mileage: number
          fuel: string
          transmission: string
          power: number
          location: string
          description: string
          video_poster: string
          video_duration: string
          features: Json
          specs: Json
          seller_name: string
          seller_type: 'private' | 'dealer'
          seller_status: 'online' | 'busy' | 'offline'
          seller_rating: number
          seller_response_time: string
          unique_views: number
          created_at: string
          video_url: string | null
          flaws_video_url: string | null
          seller_avatar_url: string | null
        }
        Insert: {
          id: string
          owner_id?: string | null
          is_demo?: boolean
          title: string
          make: string
          model: string
          year: number
          price: number
          mileage?: number
          fuel?: string
          transmission?: string
          power?: number
          location?: string
          description?: string
          video_poster: string
          video_duration?: string
          features?: Json
          specs?: Json
          seller_name: string
          seller_type: 'private' | 'dealer'
          seller_status?: 'online' | 'busy' | 'offline'
          seller_rating?: number
          seller_response_time?: string
          unique_views?: number
          created_at?: string
          video_url?: string | null
          flaws_video_url?: string | null
          seller_avatar_url?: string | null
        }
        Update: {
          id?: string
          owner_id?: string | null
          is_demo?: boolean
          title?: string
          make?: string
          model?: string
          year?: number
          price?: number
          mileage?: number
          fuel?: string
          transmission?: string
          power?: number
          location?: string
          description?: string
          video_poster?: string
          video_duration?: string
          features?: Json
          specs?: Json
          seller_name?: string
          seller_type?: 'private' | 'dealer'
          seller_status?: 'online' | 'busy' | 'offline'
          seller_rating?: number
          seller_response_time?: string
          unique_views?: number
          created_at?: string
          video_url?: string | null
          flaws_video_url?: string | null
          seller_avatar_url?: string | null
        }
        Relationships: []
      }
      listing_views: {
        Row: {
          listing_id: string
          visitor_id: string
          created_at: string
        }
        Insert: {
          listing_id: string
          visitor_id: string
          created_at?: string
        }
        Update: {
          listing_id?: string
          visitor_id?: string
          created_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          listing_id: string
          buyer_id: string
          seller_id: string
          last_message_at: string
          created_at: string
          buyer_last_read_at: string
          seller_last_read_at: string
        }
        Insert: {
          id?: string
          listing_id: string
          buyer_id: string
          seller_id: string
          last_message_at?: string
          created_at?: string
          buyer_last_read_at?: string
          seller_last_read_at?: string
        }
        Update: {
          id?: string
          listing_id?: string
          buyer_id?: string
          seller_id?: string
          last_message_at?: string
          created_at?: string
          buyer_last_read_at?: string
          seller_last_read_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          body: string | null
          video_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          body?: string | null
          video_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          body?: string | null
          video_path?: string | null
          created_at?: string
        }
        Relationships: []
      }
      reel_stats: {
        Row: {
          listing_id: string
          impressions: number
          total_watch_ms: number
          completions: number
          avg_watch_ratio: number
          updated_at: string
        }
        Insert: {
          listing_id: string
          impressions?: number
          total_watch_ms?: number
          completions?: number
          avg_watch_ratio?: number
          updated_at?: string
        }
        Update: {
          listing_id?: string
          impressions?: number
          total_watch_ms?: number
          completions?: number
          avg_watch_ratio?: number
          updated_at?: string
        }
        Relationships: []
      }
      listing_deletions: {
        Row: {
          id: string
          listing_id: string
          owner_id: string | null
          reason: 'sold_carbuy' | 'sold_elsewhere' | 'not_sold'
          listing_title: string | null
          listing_make: string | null
          listing_model: string | null
          listing_price: number | null
          created_at: string
        }
        Insert: {
          id?: string
          listing_id: string
          owner_id?: string | null
          reason: 'sold_carbuy' | 'sold_elsewhere' | 'not_sold'
          listing_title?: string | null
          listing_make?: string | null
          listing_model?: string | null
          listing_price?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          listing_id?: string
          owner_id?: string | null
          reason?: 'sold_carbuy' | 'sold_elsewhere' | 'not_sold'
          listing_title?: string | null
          listing_make?: string | null
          listing_model?: string | null
          listing_price?: number | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      record_unique_view: {
        Args: { p_listing_id: string; p_visitor_id: string }
        Returns: number
      }
      record_reel_watch: {
        Args: {
          p_listing_id: string
          p_watch_ms: number
          p_duration_ms: number
          p_completed?: boolean
        }
        Returns: undefined
      }
      get_deletion_stats: {
        Args: Record<string, never>
        Returns: {
          total_deletions: number
          sold_carbuy: number
          sold_elsewhere: number
          not_sold: number
          carbuy_conversion_rate: number
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type ListingRow = Database['public']['Tables']['listings']['Row']
export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type ConversationRow = Database['public']['Tables']['conversations']['Row']
export type MessageRow = Database['public']['Tables']['messages']['Row']
