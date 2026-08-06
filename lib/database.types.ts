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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity: {
        Row: {
          actor: string | null
          created_at: string
          detail: Json | null
          id: number
          kind: string
          message: string
          project_id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          detail?: Json | null
          id?: number
          kind: string
          message: string
          project_id: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          detail?: Json | null
          id?: number
          kind?: string
          message?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      automation: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          kind: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          kind: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
        }
        Relationships: []
      }
      change_order: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          note: string | null
          project_id: string
          status: Database["public"]["Enums"]["co_status"]
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          note?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["co_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          note?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["co_status"]
        }
        Relationships: [
          {
            foreignKeyName: "change_order_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      client_company: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      contact: {
        Row: {
          client_company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          client_company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          client_company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "client_company"
            referencedColumns: ["id"]
          },
        ]
      }
      document: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string | null
          portal_url: string | null
          portal_url_expires: string | null
          project_id: string
          source: string
          storage_path: string | null
          tag: Database["public"]["Enums"]["doc_tag"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string | null
          portal_url?: string | null
          portal_url_expires?: string | null
          project_id: string
          source?: string
          storage_path?: string | null
          tag?: Database["public"]["Enums"]["doc_tag"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          portal_url?: string | null
          portal_url_expires?: string | null
          project_id?: string
          source?: string
          storage_path?: string | null
          tag?: Database["public"]["Enums"]["doc_tag"]
        }
        Relationships: [
          {
            foreignKeyName: "document_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      event: {
        Row: {
          created_at: string
          date: string
          done: boolean
          id: string
          label: string
          partner_id: string | null
          project_id: string
          time: string | null
        }
        Insert: {
          created_at?: string
          date: string
          done?: boolean
          id?: string
          label: string
          partner_id?: string | null
          project_id: string
          time?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          done?: boolean
          id?: string
          label?: string
          partner_id?: string | null
          project_id?: string
          time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      expense: {
        Row: {
          amount: number
          created_at: string
          id: string
          label: string
          project_id: string
          spent_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          label: string
          project_id: string
          spent_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          label?: string
          project_id?: string
          spent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          issued_at: string | null
          number: string
          paid_at: string | null
          project_id: string
          status: Database["public"]["Enums"]["invoice_status"]
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          issued_at?: string | null
          number: string
          paid_at?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          issued_at?: string | null
          number?: string
          paid_at?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invoice_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      lead: {
        Row: {
          address: string | null
          appointment_at: string | null
          client_company_id: string | null
          created_at: string
          email: string | null
          follow_up_on: string | null
          id: string
          name: string
          notes: string | null
          opt_in_at: string | null
          opt_in_text: string | null
          phone: string | null
          project_id: string | null
          sms_opt_in: boolean
          source: string
          status: string
          updated_at: string
          utm: Json
        }
        Insert: {
          address?: string | null
          appointment_at?: string | null
          client_company_id?: string | null
          created_at?: string
          email?: string | null
          follow_up_on?: string | null
          id?: string
          name: string
          notes?: string | null
          opt_in_at?: string | null
          opt_in_text?: string | null
          phone?: string | null
          project_id?: string | null
          sms_opt_in?: boolean
          source?: string
          status?: string
          updated_at?: string
          utm?: Json
        }
        Update: {
          address?: string | null
          appointment_at?: string | null
          client_company_id?: string | null
          created_at?: string
          email?: string | null
          follow_up_on?: string | null
          id?: string
          name?: string
          notes?: string | null
          opt_in_at?: string | null
          opt_in_text?: string | null
          phone?: string | null
          project_id?: string | null
          sms_opt_in?: boolean
          source?: string
          status?: string
          updated_at?: string
          utm?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lead_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "client_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      org_setting: {
        Row: {
          address: string | null
          business_name: string
          default_markup_pct: number
          default_net_days: number
          email: string | null
          id: boolean
          payment_instructions: string | null
          phone: string | null
          prefix: string
          updated_at: string
          wa_verify_token: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string
          default_markup_pct?: number
          default_net_days?: number
          email?: string | null
          id?: boolean
          payment_instructions?: string | null
          phone?: string | null
          prefix?: string
          updated_at?: string
          wa_verify_token?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          default_markup_pct?: number
          default_net_days?: number
          email?: string | null
          id?: boolean
          payment_instructions?: string | null
          phone?: string | null
          prefix?: string
          updated_at?: string
          wa_verify_token?: string | null
        }
        Relationships: []
      }
      partner: {
        Row: {
          area: string | null
          created_at: string
          email: string | null
          id: string
          kind: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      payment: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["pay_method"]
          note: string | null
          paid_on: string
          project_id: string
          proof_name: string | null
          proof_path: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: Database["public"]["Enums"]["pay_method"]
          note?: string | null
          paid_on?: string
          project_id: string
          proof_name?: string | null
          proof_path?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["pay_method"]
          note?: string | null
          paid_on?: string
          project_id?: string
          proof_name?: string | null
          proof_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      price_request: {
        Row: {
          amount: number | null
          answered_at: string | null
          created_at: string
          doc_ids: string[]
          id: string
          lead_days: number | null
          notes: string | null
          opened_at: string | null
          partner_id: string
          project_id: string
          scope: string | null
          status: Database["public"]["Enums"]["request_status"]
          token: string
        }
        Insert: {
          amount?: number | null
          answered_at?: string | null
          created_at?: string
          doc_ids?: string[]
          id?: string
          lead_days?: number | null
          notes?: string | null
          opened_at?: string | null
          partner_id: string
          project_id: string
          scope?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          token?: string
        }
        Update: {
          amount?: number | null
          answered_at?: string | null
          created_at?: string
          doc_ids?: string[]
          id?: string
          lead_days?: number | null
          notes?: string | null
          opened_at?: string | null
          partner_id?: string
          project_id?: string
          scope?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_request_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_request_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      project: {
        Row: {
          address: string
          archived: boolean
          city: string | null
          client_company_id: string | null
          code: string | null
          contact_id: string | null
          cost: number | null
          created_at: string
          crew_id: string | null
          crew_rating: number | null
          crew_rating_note: string | null
          id: string
          notes: string | null
          phase: Database["public"]["Enums"]["phase"]
          price: number | null
          updated_at: string
          upload_token: string | null
          wa_crew_group_id: string | null
          wa_crew_link: string | null
          wa_sales_group_id: string | null
          wa_sales_link: string | null
        }
        Insert: {
          address: string
          archived?: boolean
          city?: string | null
          client_company_id?: string | null
          code?: string | null
          contact_id?: string | null
          cost?: number | null
          created_at?: string
          crew_id?: string | null
          crew_rating?: number | null
          crew_rating_note?: string | null
          id?: string
          notes?: string | null
          phase?: Database["public"]["Enums"]["phase"]
          price?: number | null
          updated_at?: string
          upload_token?: string | null
          wa_crew_group_id?: string | null
          wa_crew_link?: string | null
          wa_sales_group_id?: string | null
          wa_sales_link?: string | null
        }
        Update: {
          address?: string
          archived?: boolean
          city?: string | null
          client_company_id?: string | null
          code?: string | null
          contact_id?: string | null
          cost?: number | null
          created_at?: string
          crew_id?: string | null
          crew_rating?: number | null
          crew_rating_note?: string | null
          id?: string
          notes?: string | null
          phase?: Database["public"]["Enums"]["phase"]
          price?: number | null
          updated_at?: string
          upload_token?: string | null
          wa_crew_group_id?: string | null
          wa_crew_link?: string | null
          wa_sales_group_id?: string | null
          wa_sales_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "client_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
        ]
      }
      user_account: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_demo: boolean
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_demo?: boolean
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_demo?: boolean
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      wa_message: {
        Row: {
          body: string
          channel: string
          created_at: string
          direction: string
          from_name: string | null
          from_phone: string | null
          group_external_id: string | null
          id: string
          important: boolean
          lead_id: string | null
          project_id: string | null
          read_at: string | null
          status: string
          to_phone: string | null
          wamid: string | null
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          direction?: string
          from_name?: string | null
          from_phone?: string | null
          group_external_id?: string | null
          id?: string
          important?: boolean
          lead_id?: string | null
          project_id?: string | null
          read_at?: string | null
          status?: string
          to_phone?: string | null
          wamid?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          direction?: string
          from_name?: string | null
          from_phone?: string | null
          group_external_id?: string | null
          id?: string
          important?: boolean
          lead_id?: string | null
          project_id?: string | null
          read_at?: string | null
          status?: string
          to_phone?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_message_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_message_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_demo: { Args: never; Returns: boolean }
      lead_intake: {
        Args: {
          p_name: string
          p_phone: string
          p_email?: string
          p_zip?: string
          p_project?: string
          p_source?: string
          p_utm?: Json
          p_opt_in?: boolean
          p_opt_in_text?: string
        }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      portal_get_job: { Args: { p_token: string }; Returns: Json }
      portal_get_price: { Args: { p_token: string }; Returns: Json }
      portal_submit_price: {
        Args: {
          p_amount: number
          p_lead?: number
          p_notes?: string
          p_token: string
        }
        Returns: boolean
      }
      portal_submit_update: {
        Args: { p_note: string; p_tag?: string; p_token: string }
        Returns: boolean
      }
      url_token: { Args: never; Returns: string }
      wa_ingest: {
        Args: {
          p_body: string
          p_from_name: string
          p_from_phone: string
          p_group: string
          p_secret: string
          p_wamid: string
        }
        Returns: boolean
      }
    }
    Enums: {
      co_status: "pending" | "approved" | "declined"
      doc_tag: "design" | "permit" | "photo" | "contract" | "invoice" | "other"
      invoice_status: "draft" | "sent" | "paid"
      pay_method: "check" | "zelle" | "cash" | "other"
      phase:
        | "new"
        | "design"
        | "pricing"
        | "approved"
        | "in_progress"
        | "complete"
        | "paid"
      request_status: "open" | "answered" | "closed"
      user_role: "owner" | "logger"
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

export const Constants = {
  public: {
    Enums: {
      co_status: ["pending", "approved", "declined"],
      doc_tag: ["design", "permit", "photo", "contract", "invoice", "other"],
      invoice_status: ["draft", "sent", "paid"],
      pay_method: ["check", "zelle", "cash", "other"],
      phase: [
        "new",
        "design",
        "pricing",
        "approved",
        "in_progress",
        "complete",
        "paid",
      ],
      request_status: ["open", "answered", "closed"],
      user_role: ["owner", "logger"],
    },
  },
} as const
