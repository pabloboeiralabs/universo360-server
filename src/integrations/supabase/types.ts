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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      commission_beneficiaries: {
        Row: {
          created_at: string
          franchise_id: string
          id: string
          is_active: boolean
          name: string
          pix_key: string | null
          pix_key_type: string | null
          type: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          franchise_id: string
          id?: string
          is_active?: boolean
          name: string
          pix_key?: string | null
          pix_key_type?: string | null
          type: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          franchise_id?: string
          id?: string
          is_active?: boolean
          name?: string
          pix_key?: string | null
          pix_key_type?: string | null
          type?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_beneficiaries_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payouts: {
        Row: {
          amount: number
          beneficiary_id: string | null
          created_at: string
          event_id: string
          franchise_id: string
          id: string
          is_paid: boolean
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payout_type: string
          period_end: string
          period_start: string
          recipient_name: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          beneficiary_id?: string | null
          created_at?: string
          event_id: string
          franchise_id: string
          id?: string
          is_paid?: boolean
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payout_type: string
          period_end: string
          period_start: string
          recipient_name?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          beneficiary_id?: string | null
          created_at?: string
          event_id?: string
          franchise_id?: string
          id?: string
          is_paid?: boolean
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payout_type?: string
          period_end?: string
          period_start?: string
          recipient_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payouts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payouts_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          cep: string | null
          city: string | null
          classification: string | null
          cnpj: string | null
          contact_name: string | null
          contact_whatsapp: string | null
          cpf: string | null
          created_at: string
          email: string | null
          franchise_id: string
          id: string
          is_active: boolean
          name: string
          neighborhood: string | null
          number: string | null
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          reference_point: string | null
          seller_id: string | null
          state: string | null
          street: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cep?: string | null
          city?: string | null
          classification?: string | null
          cnpj?: string | null
          contact_name?: string | null
          contact_whatsapp?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          franchise_id: string
          id?: string
          is_active?: boolean
          name: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          reference_point?: string | null
          seller_id?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cep?: string | null
          city?: string | null
          classification?: string | null
          cnpj?: string | null
          contact_name?: string | null
          contact_whatsapp?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          franchise_id?: string
          id?: string
          is_active?: boolean
          name?: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          reference_point?: string | null
          seller_id?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "commission_beneficiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          cc_email: string | null
          created_at: string
          email_type: string
          error_message: string | null
          franchise_id: string | null
          id: string
          recipient_email: string
          sent_at: string
          status: string
          subject: string | null
          ticket_id: string | null
        }
        Insert: {
          cc_email?: string | null
          created_at?: string
          email_type: string
          error_message?: string | null
          franchise_id?: string | null
          id?: string
          recipient_email: string
          sent_at?: string
          status?: string
          subject?: string | null
          ticket_id?: string | null
        }
        Update: {
          cc_email?: string | null
          created_at?: string
          email_type?: string
          error_message?: string | null
          franchise_id?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string
          status?: string
          subject?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      event_grades: {
        Row: {
          created_at: string | null
          custom_grade_name: string | null
          event_id: string
          grade_id: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          custom_grade_name?: string | null
          event_id: string
          grade_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          custom_grade_name?: string | null
          event_id?: string
          grade_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_grades_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_grades_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          available_spots: number
          cash_password: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          event_date: string
          event_end_time: string | null
          event_time: string
          franchise_id: string
          id: string
          is_active: boolean
          location: string
          presenter_commission_pct: number | null
          presenter_id: string | null
          price: number
          sales_deadline: string | null
          school_commission_type: string | null
          school_commission_value: number | null
          school_name: string
          seller_commission_pct: number | null
          seller_id: string | null
          supervisor_commission_pct: number | null
          supervisor_id: string | null
          total_capacity: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          available_spots: number
          cash_password?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          event_date: string
          event_end_time?: string | null
          event_time: string
          franchise_id: string
          id?: string
          is_active?: boolean
          location: string
          presenter_commission_pct?: number | null
          presenter_id?: string | null
          price: number
          sales_deadline?: string | null
          school_commission_type?: string | null
          school_commission_value?: number | null
          school_name: string
          seller_commission_pct?: number | null
          seller_id?: string | null
          supervisor_commission_pct?: number | null
          supervisor_id?: string | null
          total_capacity: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          available_spots?: number
          cash_password?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          event_date?: string
          event_end_time?: string | null
          event_time?: string
          franchise_id?: string
          id?: string
          is_active?: boolean
          location?: string
          presenter_commission_pct?: number | null
          presenter_id?: string | null
          price?: number
          sales_deadline?: string | null
          school_commission_type?: string | null
          school_commission_value?: number | null
          school_name?: string
          seller_commission_pct?: number | null
          seller_id?: string | null
          supervisor_commission_pct?: number | null
          supervisor_id?: string | null
          total_capacity?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_presenter_id_fkey"
            columns: ["presenter_id"]
            isOneToOne: false
            referencedRelation: "commission_beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "commission_beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "commission_beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      franchises: {
        Row: {
          asaas_api_key: string | null
          asaas_webhook_token: string | null
          city: string
          commission_type: string | null
          commission_value: number | null
          created_at: string
          default_presenter_commission_pct: number | null
          default_school_commission_pct: number | null
          default_seller_commission_pct: number | null
          default_supervisor_commission_pct: number | null
          id: string
          is_active: boolean
          mercadopago_access_token: string | null
          mercadopago_public_key: string | null
          mercadopago_refresh_token: string | null
          mercadopago_user_id: number | null
          mp_token_refreshed_at: string | null
          name: string
          owner_id: string | null
          pagbank_token: string | null
          payment_gateway: string
          state: string
          updated_at: string
        }
        Insert: {
          asaas_api_key?: string | null
          asaas_webhook_token?: string | null
          city: string
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          default_presenter_commission_pct?: number | null
          default_school_commission_pct?: number | null
          default_seller_commission_pct?: number | null
          default_supervisor_commission_pct?: number | null
          id?: string
          is_active?: boolean
          mercadopago_access_token?: string | null
          mercadopago_public_key?: string | null
          mercadopago_refresh_token?: string | null
          mercadopago_user_id?: number | null
          mp_token_refreshed_at?: string | null
          name: string
          owner_id?: string | null
          pagbank_token?: string | null
          payment_gateway?: string
          state: string
          updated_at?: string
        }
        Update: {
          asaas_api_key?: string | null
          asaas_webhook_token?: string | null
          city?: string
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          default_presenter_commission_pct?: number | null
          default_school_commission_pct?: number | null
          default_seller_commission_pct?: number | null
          default_supervisor_commission_pct?: number | null
          id?: string
          is_active?: boolean
          mercadopago_access_token?: string | null
          mercadopago_public_key?: string | null
          mercadopago_refresh_token?: string | null
          mercadopago_user_id?: number | null
          mp_token_refreshed_at?: string | null
          name?: string
          owner_id?: string | null
          pagbank_token?: string | null
          payment_gateway?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      grades: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          created_at: string
          entity_name: string
          error_count: number
          file_name: string | null
          franchise_id: string | null
          id: string
          imported_by: string | null
          new_count: number
          total_rows: number
          update_count: number
        }
        Insert: {
          created_at?: string
          entity_name: string
          error_count?: number
          file_name?: string | null
          franchise_id?: string | null
          id?: string
          imported_by?: string | null
          new_count?: number
          total_rows?: number
          update_count?: number
        }
        Update: {
          created_at?: string
          entity_name?: string
          error_count?: number
          file_name?: string | null
          franchise_id?: string | null
          id?: string
          imported_by?: string | null
          new_count?: number
          total_rows?: number
          update_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          must_change_password: boolean
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          amount: number
          class_grade: string | null
          created_at: string
          customer_email: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          event_id: string
          franchise_id: string
          id: string
          mp_payment_id: string | null
          parent_name: string | null
          payment_id: string | null
          payment_method: string | null
          payment_status: string
          quantity: number
          refund_reason: string | null
          refunded_at: string | null
          shift: string | null
          spots_decremented: boolean
          student_name: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          class_grade?: string | null
          created_at?: string
          customer_email: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          event_id: string
          franchise_id: string
          id?: string
          mp_payment_id?: string | null
          parent_name?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string
          quantity?: number
          refund_reason?: string | null
          refunded_at?: string | null
          shift?: string | null
          spots_decremented?: boolean
          student_name?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          class_grade?: string | null
          created_at?: string
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          event_id?: string
          franchise_id?: string
          id?: string
          mp_payment_id?: string | null
          parent_name?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string
          quantity?: number
          refund_reason?: string | null
          refunded_at?: string | null
          shift?: string | null
          spots_decremented?: boolean
          student_name?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address: string | null
          capacity: number | null
          city: string
          created_at: string
          franchise_id: string
          id: string
          is_active: boolean
          name: string
          state: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city: string
          created_at?: string
          franchise_id: string
          id?: string
          is_active?: boolean
          name: string
          state: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string
          created_at?: string
          franchise_id?: string
          id?: string
          is_active?: boolean
          name?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_spots: {
        Args: { p_event_id: string; p_quantity: number; p_ticket_id: string }
        Returns: boolean
      }
      exec_sql: { Args: { sql_query: string }; Returns: Json }
      get_admin_dashboard_stats: {
        Args: never
        Returns: {
          total_events: number
          total_franchises: number
          total_revenue: number
          total_students: number
          total_tickets: number
        }[]
      }
      get_mp_credentials_by_franchise: {
        Args: { _franchise_id: string }
        Returns: {
          access_token: string
          public_key: string
        }[]
      }
      get_user_beneficiary: { Args: { _user_id: string }; Returns: string }
      get_user_franchise: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "franchise_owner"
        | "customer"
        | "collaborator"
        | "atendente"
        | "desenvolvedor"
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
      app_role: [
        "admin",
        "franchise_owner",
        "customer",
        "collaborator",
        "atendente",
        "desenvolvedor",
      ],
    },
  },
} as const
