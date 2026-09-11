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
      audit_events: {
        Row: {
          actor: Database["public"]["Enums"]["actor_kind"]
          actor_name: string | null
          created_at: string
          id: string
          payload: Json
          return_id: string | null
          stage: string
          summary: string
        }
        Insert: {
          actor?: Database["public"]["Enums"]["actor_kind"]
          actor_name?: string | null
          created_at?: string
          id?: string
          payload?: Json
          return_id?: string | null
          stage: string
          summary: string
        }
        Update: {
          actor?: Database["public"]["Enums"]["actor_kind"]
          actor_name?: string | null
          created_at?: string
          id?: string
          payload?: Json
          return_id?: string | null
          stage?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      behaviour_signals: {
        Row: {
          behaviour_score: number
          created_at: string
          id: string
          return_id: string
          signals: Json
        }
        Insert: {
          behaviour_score: number
          created_at?: string
          id?: string
          return_id: string
          signals?: Json
        }
        Update: {
          behaviour_score?: number
          created_at?: string
          id?: string
          return_id?: string
          signals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "behaviour_signals_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          avg_delivery_days: number
          avg_items_per_order: number
          avg_order_value: number
          avg_review_score: number
          city: string
          city_code: number
          created_at: string
          customer_lifetime_days: number
          days_since_last_order: number
          external_id: string
          freight_to_value_ratio: number
          high_rating_count: number
          id: string
          is_one_time_buyer: number
          late_deliveries: number
          late_delivery_percentage: number
          low_rating_count: number
          low_rating_percentage: number
          state: string
          state_code: number
          total_freight: number
          total_items_purchased: number
          total_orders: number
          total_reviews: number
          total_spent: number
        }
        Insert: {
          avg_delivery_days?: number
          avg_items_per_order?: number
          avg_order_value?: number
          avg_review_score?: number
          city: string
          city_code: number
          created_at?: string
          customer_lifetime_days?: number
          days_since_last_order?: number
          external_id: string
          freight_to_value_ratio?: number
          high_rating_count?: number
          id?: string
          is_one_time_buyer?: number
          late_deliveries?: number
          late_delivery_percentage?: number
          low_rating_count?: number
          low_rating_percentage?: number
          state: string
          state_code: number
          total_freight?: number
          total_items_purchased?: number
          total_orders?: number
          total_reviews?: number
          total_spent?: number
        }
        Update: {
          avg_delivery_days?: number
          avg_items_per_order?: number
          avg_order_value?: number
          avg_review_score?: number
          city?: string
          city_code?: number
          created_at?: string
          customer_lifetime_days?: number
          days_since_last_order?: number
          external_id?: string
          freight_to_value_ratio?: number
          high_rating_count?: number
          id?: string
          is_one_time_buyer?: number
          late_deliveries?: number
          late_delivery_percentage?: number
          low_rating_count?: number
          low_rating_percentage?: number
          state?: string
          state_code?: number
          total_freight?: number
          total_items_purchased?: number
          total_orders?: number
          total_reviews?: number
          total_spent?: number
        }
        Relationships: []
      }
      decisions: {
        Row: {
          confidence: number
          created_at: string
          id: string
          is_current: boolean
          outcome: Database["public"]["Enums"]["decision_outcome"]
          rationale: Json
          return_id: string
          source: Database["public"]["Enums"]["actor_kind"]
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          is_current?: boolean
          outcome: Database["public"]["Enums"]["decision_outcome"]
          rationale?: Json
          return_id: string
          source?: Database["public"]["Enums"]["actor_kind"]
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          is_current?: boolean
          outcome?: Database["public"]["Enums"]["decision_outcome"]
          rationale?: Json
          return_id?: string
          source?: Database["public"]["Enums"]["actor_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "decisions_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      fusion_results: {
        Row: {
          agreement: number
          conflicts: Json
          created_at: string
          evidence: Json
          id: string
          return_id: string
          trust_score: number
        }
        Insert: {
          agreement: number
          conflicts?: Json
          created_at?: string
          evidence?: Json
          id?: string
          return_id: string
          trust_score: number
        }
        Update: {
          agreement?: number
          conflicts?: Json
          created_at?: string
          evidence?: Json
          id?: string
          return_id?: string
          trust_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "fusion_results_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      human_reviews: {
        Row: {
          agreed_with_system: boolean
          created_at: string
          id: string
          notes: string | null
          return_id: string
          reviewer_name: string
          verdict: Database["public"]["Enums"]["decision_outcome"]
        }
        Insert: {
          agreed_with_system: boolean
          created_at?: string
          id?: string
          notes?: string | null
          return_id: string
          reviewer_name: string
          verdict: Database["public"]["Enums"]["decision_outcome"]
        }
        Update: {
          agreed_with_system?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          return_id?: string
          reviewer_name?: string
          verdict?: Database["public"]["Enums"]["decision_outcome"]
        }
        Relationships: [
          {
            foreignKeyName: "human_reviews_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          actual_delivery_days: number
          avg_item_price: number
          category_code: number
          created_at: string
          customer_id: string
          delivered_at: string | null
          delivery_delay_days: number
          estimated_delivery_at: string | null
          estimated_delivery_days: number
          external_id: string
          freight_ratio: number
          has_review_comment: number
          historical_return_flag: number
          id: string
          is_late_delivery: number
          num_items: number
          price_segment: number
          purchase_day_of_week: number
          purchase_month: number
          purchased_at: string
          review_score: number
          total_freight: number
          total_price: number
        }
        Insert: {
          actual_delivery_days?: number
          avg_item_price: number
          category_code: number
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          delivery_delay_days?: number
          estimated_delivery_at?: string | null
          estimated_delivery_days?: number
          external_id: string
          freight_ratio?: number
          has_review_comment?: number
          historical_return_flag?: number
          id?: string
          is_late_delivery?: number
          num_items?: number
          price_segment?: number
          purchase_day_of_week?: number
          purchase_month?: number
          purchased_at: string
          review_score?: number
          total_freight?: number
          total_price: number
        }
        Update: {
          actual_delivery_days?: number
          avg_item_price?: number
          category_code?: number
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          delivery_delay_days?: number
          estimated_delivery_at?: string | null
          estimated_delivery_days?: number
          external_id?: string
          freight_ratio?: number
          has_review_comment?: number
          historical_return_flag?: number
          id?: string
          is_late_delivery?: number
          num_items?: number
          price_segment?: number
          purchase_day_of_week?: number
          purchase_month?: number
          purchased_at?: string
          review_score?: number
          total_freight?: number
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_evaluations: {
        Row: {
          created_at: string
          eligible: boolean
          id: string
          return_id: string
          rules: Json
          window_days_remaining: number | null
        }
        Insert: {
          created_at?: string
          eligible: boolean
          id?: string
          return_id: string
          rules?: Json
          window_days_remaining?: number | null
        }
        Update: {
          created_at?: string
          eligible?: boolean
          id?: string
          return_id?: string
          rules?: Json
          window_days_remaining?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "policy_evaluations_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          confidence: number
          contributions: Json
          created_at: string
          feature_vector: Json
          id: string
          model_key: string
          model_label: string
          return_id: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          risk_score: number
        }
        Insert: {
          confidence: number
          contributions?: Json
          created_at?: string
          feature_vector?: Json
          id?: string
          model_key: string
          model_label: string
          return_id: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          risk_score: number
        }
        Update: {
          confidence?: number
          contributions?: Json
          created_at?: string
          feature_vector?: Json
          id?: string
          model_key?: string
          model_label?: string
          return_id?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "predictions_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          avg_rating: number
          code: number
          complaint_rate: number
          dissatisfaction_rate: number
          low_rating_pct: number
          name: string
        }
        Insert: {
          avg_rating?: number
          code: number
          complaint_rate?: number
          dissatisfaction_rate?: number
          low_rating_pct?: number
          name: string
        }
        Update: {
          avg_rating?: number
          code?: number
          complaint_rate?: number
          dissatisfaction_rate?: number
          low_rating_pct?: number
          name?: string
        }
        Relationships: []
      }
      return_images: {
        Row: {
          byte_size: number
          content_type: string
          created_at: string
          id: string
          return_id: string
          storage_path: string
        }
        Insert: {
          byte_size: number
          content_type: string
          created_at?: string
          id?: string
          return_id: string
          storage_path: string
        }
        Update: {
          byte_size?: number
          content_type?: string
          created_at?: string
          id?: string
          return_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_images_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          claimed_condition: string
          created_at: string
          description: string | null
          id: string
          order_id: string
          reason_code: string
          reference: string
          status: Database["public"]["Enums"]["return_status"]
          updated_at: string
        }
        Insert: {
          claimed_condition: string
          created_at?: string
          description?: string | null
          id?: string
          order_id: string
          reason_code: string
          reference: string
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
        }
        Update: {
          claimed_condition?: string
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string
          reason_code?: string
          reference?: string
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      vision_analyses: {
        Row: {
          created_at: string
          damage_score: number | null
          findings: Json
          id: string
          image_id: string | null
          is_fallback: boolean
          matches_claim: boolean | null
          model: string
          observed_condition: string | null
          provider: string
          return_id: string
          summary: string | null
        }
        Insert: {
          created_at?: string
          damage_score?: number | null
          findings?: Json
          id?: string
          image_id?: string | null
          is_fallback?: boolean
          matches_claim?: boolean | null
          model: string
          observed_condition?: string | null
          provider: string
          return_id: string
          summary?: string | null
        }
        Update: {
          created_at?: string
          damage_score?: number | null
          findings?: Json
          id?: string
          image_id?: string | null
          is_fallback?: boolean
          matches_claim?: boolean | null
          model?: string
          observed_condition?: string | null
          provider?: string
          return_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vision_analyses_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "return_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vision_analyses_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      actor_kind: "SYSTEM" | "HUMAN"
      decision_outcome:
        | "AUTO_APPROVE"
        | "MANUAL_REVIEW"
        | "REFUND_ON_INSPECTION"
        | "DECLINE"
      return_status: "SUBMITTED" | "ANALYSED" | "IN_REVIEW" | "RESOLVED"
      risk_level: "LOW" | "MEDIUM" | "HIGH"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      actor_kind: ["SYSTEM", "HUMAN"],
      decision_outcome: [
        "AUTO_APPROVE",
        "MANUAL_REVIEW",
        "REFUND_ON_INSPECTION",
        "DECLINE",
      ],
      return_status: ["SUBMITTED", "ANALYSED", "IN_REVIEW", "RESOLVED"],
      risk_level: ["LOW", "MEDIUM", "HIGH"],
    },
  },
} as const
