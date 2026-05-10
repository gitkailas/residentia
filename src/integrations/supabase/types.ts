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
      announcements: {
        Row: {
          created_at: string
          id: string
          message: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          title?: string
        }
        Relationships: []
      }
      billing_cycles: {
        Row: {
          created_at: string
          garbage_due: number
          id: string
          is_waiver_period: boolean
          maintenance_due: number
          month: string
          total_due: number
          unit_id: string
          year: number
        }
        Insert: {
          created_at?: string
          garbage_due?: number
          id?: string
          is_waiver_period?: boolean
          maintenance_due?: number
          month: string
          total_due?: number
          unit_id: string
          year: number
        }
        Update: {
          created_at?: string
          garbage_due?: number
          id?: string
          is_waiver_period?: boolean
          maintenance_due?: number
          month?: string
          total_due?: number
          unit_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_cycles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_garbage: number
          amount_maintenance: number
          balance: number
          billing_cycle_id: string | null
          created_at: string
          id: string
          payment_date: string
          payment_mode: string | null
          proof_url: string | null
          recorded_by: string | null
          reference_no: string | null
          status: string
          total_paid: number
          unit_id: string
        }
        Insert: {
          amount_garbage?: number
          amount_maintenance?: number
          balance?: number
          billing_cycle_id?: string | null
          created_at?: string
          id?: string
          payment_date?: string
          payment_mode?: string | null
          proof_url?: string | null
          recorded_by?: string | null
          reference_no?: string | null
          status?: string
          total_paid?: number
          unit_id: string
        }
        Update: {
          amount_garbage?: number
          amount_maintenance?: number
          balance?: number
          billing_cycle_id?: string | null
          created_at?: string
          id?: string
          payment_date?: string
          payment_mode?: string | null
          proof_url?: string | null
          recorded_by?: string | null
          reference_no?: string | null
          status?: string
          total_paid?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          unit_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          unit_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      queries: {
        Row: {
          admin_reply: string | null
          created_at: string
          description: string
          id: string
          status: string
          subject: string
          unit_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          description: string
          id?: string
          status?: string
          subject: string
          unit_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          description?: string
          id?: string
          status?: string
          subject?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          unit_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          unit_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          billing_enabled: boolean
          created_at: string
          floor: number
          id: string
          key_handover_date: string | null
          owner_name: string | null
          registration_date: string | null
          status: string
          type: string
          unit_no: string
          updated_at: string
          waiver_end_date: string | null
          waiver_start_date: string | null
        }
        Insert: {
          billing_enabled?: boolean
          created_at?: string
          floor: number
          id?: string
          key_handover_date?: string | null
          owner_name?: string | null
          registration_date?: string | null
          status?: string
          type: string
          unit_no: string
          updated_at?: string
          waiver_end_date?: string | null
          waiver_start_date?: string | null
        }
        Update: {
          billing_enabled?: boolean
          created_at?: string
          floor?: number
          id?: string
          key_handover_date?: string | null
          owner_name?: string | null
          registration_date?: string | null
          status?: string
          type?: string
          unit_no?: string
          updated_at?: string
          waiver_end_date?: string | null
          waiver_start_date?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waivers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          billing_cycle_id: string | null
          created_at: string
          final_amount: number
          id: string
          original_amount: number
          reason: string
          status: string
          unit_id: string
          waiver_amount: number
          waiver_type: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          billing_cycle_id?: string | null
          created_at?: string
          final_amount?: number
          id?: string
          original_amount?: number
          reason: string
          status?: string
          unit_id: string
          waiver_amount?: number
          waiver_type: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          billing_cycle_id?: string | null
          created_at?: string
          final_amount?: number
          id?: string
          original_amount?: number
          reason?: string
          status?: string
          unit_id?: string
          waiver_amount?: number
          waiver_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "waivers_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waivers_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "resident"
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
      app_role: ["admin", "resident"],
    },
  },
} as const
