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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json | null
          entity_id: string | null
          entity_type: string
          id: number
          project_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: number
          project_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: number
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
      attachment: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          owner_id: string
          owner_type: string
          project_id: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          owner_id: string
          owner_type: string
          project_id?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          owner_id?: string
          owner_type?: string
          project_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachment_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachment_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "attachment_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
        ]
      }
      bid: {
        Row: {
          amount: number
          bid_invite_id: string
          id: string
          lead_time_days: number | null
          notes: string | null
          status: Database["public"]["Enums"]["bid_status"]
          submitted_at: string
          updated_at: string
        }
        Insert: {
          amount: number
          bid_invite_id: string
          id?: string
          lead_time_days?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["bid_status"]
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bid_invite_id?: string
          id?: string
          lead_time_days?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["bid_status"]
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_bid_invite_id_fkey"
            columns: ["bid_invite_id"]
            isOneToOne: true
            referencedRelation: "bid_invite"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_invite: {
        Row: {
          access_pin: string | null
          access_token: string
          bid_request_id: string
          first_opened_at: string | null
          id: string
          invited_at: string
          last_opened_at: string | null
          partner_id: string
          reminded_at: string | null
          revoked_at: string | null
        }
        Insert: {
          access_pin?: string | null
          access_token: string
          bid_request_id: string
          first_opened_at?: string | null
          id?: string
          invited_at?: string
          last_opened_at?: string | null
          partner_id: string
          reminded_at?: string | null
          revoked_at?: string | null
        }
        Update: {
          access_pin?: string | null
          access_token?: string
          bid_request_id?: string
          first_opened_at?: string | null
          id?: string
          invited_at?: string
          last_opened_at?: string | null
          partner_id?: string
          reminded_at?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_invite_bid_request_id_fkey"
            columns: ["bid_request_id"]
            isOneToOne: false
            referencedRelation: "bid_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_invite_bid_request_id_fkey"
            columns: ["bid_request_id"]
            isOneToOne: false
            referencedRelation: "v_bid_board"
            referencedColumns: ["bid_request_id"]
          },
          {
            foreignKeyName: "bid_invite_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_invite_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_bid_board"
            referencedColumns: ["partner_id"]
          },
        ]
      }
      bid_request: {
        Row: {
          created_at: string
          created_by: string | null
          design_id: string | null
          due_at: string | null
          id: string
          instructions: string | null
          project_id: string
          scope: Database["public"]["Enums"]["bid_scope"]
          status: Database["public"]["Enums"]["bid_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          design_id?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          project_id: string
          scope: Database["public"]["Enums"]["bid_scope"]
          status?: Database["public"]["Enums"]["bid_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          design_id?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          project_id?: string
          scope?: Database["public"]["Enums"]["bid_scope"]
          status?: Database["public"]["Enums"]["bid_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_request_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_request_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "design"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_request_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_request_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
      change_order: {
        Row: {
          approval_channel:
            | Database["public"]["Enums"]["approval_channel"]
            | null
          approval_note: string | null
          approved_at: string | null
          cost_delta: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          price_delta: number
          project_id: string
          raised_by_partner: string | null
          status: Database["public"]["Enums"]["change_order_status"]
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          approval_channel?:
            | Database["public"]["Enums"]["approval_channel"]
            | null
          approval_note?: string | null
          approved_at?: string | null
          cost_delta?: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          price_delta?: number
          project_id: string
          raised_by_partner?: string | null
          status?: Database["public"]["Enums"]["change_order_status"]
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          approval_channel?:
            | Database["public"]["Enums"]["approval_channel"]
            | null
          approval_note?: string | null
          approved_at?: string | null
          cost_delta?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          price_delta?: number
          project_id?: string
          raised_by_partner?: string | null
          status?: Database["public"]["Enums"]["change_order_status"]
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_order_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "change_order_raised_by_partner_fkey"
            columns: ["raised_by_partner"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_raised_by_partner_fkey"
            columns: ["raised_by_partner"]
            isOneToOne: false
            referencedRelation: "v_bid_board"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "change_order_upload_fk"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "upload"
            referencedColumns: ["id"]
          },
        ]
      }
      client_company: {
        Row: {
          billing_address: string | null
          billing_email: string | null
          created_at: string
          default_margin_type: Database["public"]["Enums"]["margin_type"] | null
          default_margin_value: number | null
          default_net_days: number | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          billing_email?: string | null
          created_at?: string
          default_margin_type?:
            | Database["public"]["Enums"]["margin_type"]
            | null
          default_margin_value?: number | null
          default_net_days?: number | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          billing_email?: string | null
          created_at?: string
          default_margin_type?:
            | Database["public"]["Enums"]["margin_type"]
            | null
          default_margin_value?: number | null
          default_net_days?: number | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact: {
        Row: {
          client_company_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          is_primary: boolean
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          client_company_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          client_company_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
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
      design: {
        Row: {
          completed_at: string | null
          created_at: string
          designer_id: string | null
          dispatched_at: string | null
          id: string
          notes: string | null
          project_id: string
          revision: number
          source: Database["public"]["Enums"]["design_source"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          designer_id?: string | null
          dispatched_at?: string | null
          id?: string
          notes?: string | null
          project_id: string
          revision?: number
          source?: Database["public"]["Enums"]["design_source"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          designer_id?: string | null
          dispatched_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          revision?: number
          source?: Database["public"]["Enums"]["design_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "v_bid_board"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "design_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
      extracted_claim: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          message_id: string
          model_version: string | null
          payload: Json
          project_id: string
          type: Database["public"]["Enums"]["claim_type"]
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          message_id: string
          model_version?: string | null
          payload?: Json
          project_id: string
          type: Database["public"]["Enums"]["claim_type"]
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          message_id?: string
          model_version?: string | null
          payload?: Json
          project_id?: string
          type?: Database["public"]["Enums"]["claim_type"]
        }
        Relationships: [
          {
            foreignKeyName: "extracted_claim_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_claim_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_claim_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
      inspection: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          project_id: string
          reinspection_of: string | null
          result: Database["public"]["Enums"]["inspection_result"]
          result_at: string | null
          scheduled_date: string | null
          task_id: string | null
          type: Database["public"]["Enums"]["inspection_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          reinspection_of?: string | null
          result?: Database["public"]["Enums"]["inspection_result"]
          result_at?: string | null
          scheduled_date?: string | null
          task_id?: string | null
          type: Database["public"]["Enums"]["inspection_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          reinspection_of?: string | null
          result?: Database["public"]["Enums"]["inspection_result"]
          result_at?: string | null
          scheduled_date?: string | null
          task_id?: string | null
          type?: Database["public"]["Enums"]["inspection_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "inspection_reinspection_of_fkey"
            columns: ["reinspection_of"]
            isOneToOne: false
            referencedRelation: "inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["task_id"]
          },
        ]
      }
      invoice: {
        Row: {
          amount: number
          amount_paid: number
          client_company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          issued_at: string | null
          milestone_id: string | null
          net_days: number | null
          notes: string | null
          number: string
          paid_at: string | null
          payment_ref: string | null
          project_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          client_company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          issued_at?: string | null
          milestone_id?: string | null
          net_days?: number | null
          notes?: string | null
          number: string
          paid_at?: string | null
          payment_ref?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          client_company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          issued_at?: string | null
          milestone_id?: string | null
          net_days?: number | null
          notes?: string | null
          number?: string
          paid_at?: string | null
          payment_ref?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "client_company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
      job_link: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          last_used_at: string | null
          partner_id: string | null
          project_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          partner_id?: string | null
          project_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          partner_id?: string | null
          project_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_link_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_link_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_link_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_bid_board"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "job_link_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_link_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
      message: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          audience: Database["public"]["Enums"]["message_audience"]
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          contact_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          error: string | null
          external_id: string | null
          from_contact_id: string | null
          from_display_name: string | null
          from_partner_id: string | null
          from_phone: string | null
          has_media: boolean
          id: string
          invoice_id: string | null
          milestone_id: string | null
          partner_id: string | null
          project_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          task_id: string | null
          template_id: string | null
          to_phone: string | null
          transcript: string | null
          updated_at: string
          whatsapp_group_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          audience: Database["public"]["Enums"]["message_audience"]
          body: string
          channel?: Database["public"]["Enums"]["message_channel"]
          contact_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          error?: string | null
          external_id?: string | null
          from_contact_id?: string | null
          from_display_name?: string | null
          from_partner_id?: string | null
          from_phone?: string | null
          has_media?: boolean
          id?: string
          invoice_id?: string | null
          milestone_id?: string | null
          partner_id?: string | null
          project_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          task_id?: string | null
          template_id?: string | null
          to_phone?: string | null
          transcript?: string | null
          updated_at?: string
          whatsapp_group_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: Database["public"]["Enums"]["message_audience"]
          body?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          contact_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          error?: string | null
          external_id?: string | null
          from_contact_id?: string | null
          from_display_name?: string | null
          from_partner_id?: string | null
          from_phone?: string | null
          has_media?: boolean
          id?: string
          invoice_id?: string | null
          milestone_id?: string | null
          partner_id?: string | null
          project_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          task_id?: string | null
          template_id?: string | null
          to_phone?: string | null
          transcript?: string | null
          updated_at?: string
          whatsapp_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_from_contact_id_fkey"
            columns: ["from_contact_id"]
            isOneToOne: false
            referencedRelation: "contact"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_from_partner_id_fkey"
            columns: ["from_partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_from_partner_id_fkey"
            columns: ["from_partner_id"]
            isOneToOne: false
            referencedRelation: "v_bid_board"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "message_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_open_receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_bid_board"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "message_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "message_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "message_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_template"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_whatsapp_group_fk"
            columns: ["whatsapp_group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_group"
            referencedColumns: ["id"]
          },
        ]
      }
      message_template: {
        Row: {
          audience: Database["public"]["Enums"]["message_audience"]
          body: string
          created_at: string
          id: string
          is_active: boolean
          key: string
          updated_at: string
        }
        Insert: {
          audience: Database["public"]["Enums"]["message_audience"]
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["message_audience"]
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      milestone: {
        Row: {
          client_amount: number | null
          created_at: string
          id: string
          name: string
          payout_amount: number | null
          project_id: string
          reached_at: string | null
          sequence: number
          status: Database["public"]["Enums"]["milestone_status"]
          trigger: Database["public"]["Enums"]["milestone_trigger"]
          updated_at: string
        }
        Insert: {
          client_amount?: number | null
          created_at?: string
          id?: string
          name: string
          payout_amount?: number | null
          project_id: string
          reached_at?: string | null
          sequence: number
          status?: Database["public"]["Enums"]["milestone_status"]
          trigger?: Database["public"]["Enums"]["milestone_trigger"]
          updated_at?: string
        }
        Update: {
          client_amount?: number | null
          created_at?: string
          id?: string
          name?: string
          payout_amount?: number | null
          project_id?: string
          reached_at?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          trigger?: Database["public"]["Enums"]["milestone_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
      milestone_template: {
        Row: {
          client_pct: number | null
          id: string
          job_type: Database["public"]["Enums"]["job_type"]
          name: string
          payout_pct: number | null
          sequence: number
          trigger: Database["public"]["Enums"]["milestone_trigger"]
        }
        Insert: {
          client_pct?: number | null
          id?: string
          job_type: Database["public"]["Enums"]["job_type"]
          name: string
          payout_pct?: number | null
          sequence: number
          trigger: Database["public"]["Enums"]["milestone_trigger"]
        }
        Update: {
          client_pct?: number | null
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          name?: string
          payout_pct?: number | null
          sequence?: number
          trigger?: Database["public"]["Enums"]["milestone_trigger"]
        }
        Relationships: []
      }
      org_setting: {
        Row: {
          default_markup_pct: number
          default_net_days: number
          id: boolean
          invoice_prefix: string
          legal_name: string | null
          updated_at: string
          workdays: number[]
        }
        Insert: {
          default_markup_pct?: number
          default_net_days?: number
          id?: boolean
          invoice_prefix?: string
          legal_name?: string | null
          updated_at?: string
          workdays?: number[]
        }
        Update: {
          default_markup_pct?: number
          default_net_days?: number
          id?: boolean
          invoice_prefix?: string
          legal_name?: string | null
          updated_at?: string
          workdays?: number[]
        }
        Relationships: []
      }
      partner: {
        Row: {
          can_bid: boolean
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          service_area: string | null
          type: Database["public"]["Enums"]["partner_type"]
          updated_at: string
        }
        Insert: {
          can_bid?: boolean
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          service_area?: string | null
          type?: Database["public"]["Enums"]["partner_type"]
          updated_at?: string
        }
        Update: {
          can_bid?: boolean
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          service_area?: string | null
          type?: Database["public"]["Enums"]["partner_type"]
          updated_at?: string
        }
        Relationships: []
      }
      payout: {
        Row: {
          amount: number
          approved_at: string | null
          created_at: string
          id: string
          milestone_id: string | null
          notes: string | null
          paid_at: string | null
          partner_id: string
          payment_ref: string | null
          project_id: string
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          created_at?: string
          id?: string
          milestone_id?: string | null
          notes?: string | null
          paid_at?: string | null
          partner_id: string
          payment_ref?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          created_at?: string
          id?: string
          milestone_id?: string | null
          notes?: string | null
          paid_at?: string | null
          partner_id?: string
          payment_ref?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_bid_board"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "payout_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
      project: {
        Row: {
          access_notes: string | null
          address_line1: string
          address_line2: string | null
          city: string | null
          client_company_id: string
          closed_at: string | null
          code: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          intake_note: string | null
          job_type: Database["public"]["Enums"]["job_type"]
          lost_reason: string | null
          on_hold_reason: string | null
          postal_code: string | null
          sold_at: string | null
          state: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          access_notes?: string | null
          address_line1: string
          address_line2?: string | null
          city?: string | null
          client_company_id: string
          closed_at?: string | null
          code?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          intake_note?: string | null
          job_type?: Database["public"]["Enums"]["job_type"]
          lost_reason?: string | null
          on_hold_reason?: string | null
          postal_code?: string | null
          sold_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          access_notes?: string | null
          address_line1?: string
          address_line2?: string | null
          city?: string | null
          client_company_id?: string
          closed_at?: string | null
          code?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          intake_note?: string | null
          job_type?: Database["public"]["Enums"]["job_type"]
          lost_reason?: string | null
          on_hold_reason?: string | null
          postal_code?: string | null
          sold_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
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
            foreignKeyName: "project_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
        ]
      }
      quote: {
        Row: {
          approval_channel:
            | Database["public"]["Enums"]["approval_channel"]
            | null
          approval_note: string | null
          cost_total: number
          created_at: string
          created_by: string | null
          id: string
          margin_amount: number | null
          margin_type: Database["public"]["Enums"]["margin_type"] | null
          margin_value: number | null
          notes: string | null
          price: number
          project_id: string
          responded_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
          version: number
        }
        Insert: {
          approval_channel?:
            | Database["public"]["Enums"]["approval_channel"]
            | null
          approval_note?: string | null
          cost_total?: number
          created_at?: string
          created_by?: string | null
          id?: string
          margin_amount?: number | null
          margin_type?: Database["public"]["Enums"]["margin_type"] | null
          margin_value?: number | null
          notes?: string | null
          price: number
          project_id: string
          responded_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          approval_channel?:
            | Database["public"]["Enums"]["approval_channel"]
            | null
          approval_note?: string | null
          cost_total?: number
          created_at?: string
          created_by?: string | null
          id?: string
          margin_amount?: number | null
          margin_type?: Database["public"]["Enums"]["margin_type"] | null
          margin_value?: number | null
          notes?: string | null
          price?: number
          project_id?: string
          responded_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
      quote_cost_line: {
        Row: {
          amount: number
          bid_id: string | null
          id: string
          label: string
          partner_id: string | null
          quote_id: string
          sort_order: number
        }
        Insert: {
          amount: number
          bid_id?: string | null
          id?: string
          label: string
          partner_id?: string | null
          quote_id: string
          sort_order?: number
        }
        Update: {
          amount?: number
          bid_id?: string | null
          id?: string
          label?: string
          partner_id?: string | null
          quote_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_cost_line_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bid"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_cost_line_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_cost_line_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_bid_board"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "quote_cost_line_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion: {
        Row: {
          claim_id: string | null
          confidence: number | null
          created_at: string
          detail: string | null
          headline: string
          id: string
          project_id: string
          proposed_action: Json
          resolved_at: string | null
          resolved_by: string | null
          rule_key: string
          source_message_id: string | null
          status: Database["public"]["Enums"]["suggestion_status"]
        }
        Insert: {
          claim_id?: string | null
          confidence?: number | null
          created_at?: string
          detail?: string | null
          headline: string
          id?: string
          project_id: string
          proposed_action?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          rule_key: string
          source_message_id?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
        }
        Update: {
          claim_id?: string | null
          confidence?: number | null
          created_at?: string
          detail?: string | null
          headline?: string
          id?: string
          project_id?: string
          proposed_action?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          rule_key?: string
          source_message_id?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "extracted_claim"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "suggestion_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "message"
            referencedColumns: ["id"]
          },
        ]
      }
      task: {
        Row: {
          blocked_reason: string | null
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          partner_id: string | null
          project_id: string
          scheduled_date: string | null
          sequence: number
          slot: Database["public"]["Enums"]["time_slot"]
          start_time: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string | null
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
        }
        Insert: {
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          partner_id?: string | null
          project_id: string
          scheduled_date?: string | null
          sequence?: number
          slot?: Database["public"]["Enums"]["time_slot"]
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string | null
          type: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Update: {
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          partner_id?: string | null
          project_id?: string
          scheduled_date?: string | null
          sequence?: number
          slot?: Database["public"]["Enums"]["time_slot"]
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string | null
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_bid_board"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
      task_reschedule: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_date: string | null
          new_slot: Database["public"]["Enums"]["time_slot"] | null
          old_date: string | null
          old_slot: Database["public"]["Enums"]["time_slot"] | null
          reason: string | null
          task_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_date?: string | null
          new_slot?: Database["public"]["Enums"]["time_slot"] | null
          old_date?: string | null
          old_slot?: Database["public"]["Enums"]["time_slot"] | null
          reason?: string | null
          task_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_date?: string | null
          new_slot?: Database["public"]["Enums"]["time_slot"] | null
          old_date?: string | null
          old_slot?: Database["public"]["Enums"]["time_slot"] | null
          reason?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reschedule_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reschedule_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reschedule_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["task_id"]
          },
        ]
      }
      upload: {
        Row: {
          created_at: string
          id: string
          job_link_id: string | null
          note: string | null
          project_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          tag: Database["public"]["Enums"]["upload_tag"]
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_link_id?: string | null
          note?: string | null
          project_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          tag?: Database["public"]["Enums"]["upload_tag"]
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          job_link_id?: string | null
          note?: string | null
          project_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          tag?: Database["public"]["Enums"]["upload_tag"]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_job_link_id_fkey"
            columns: ["job_link_id"]
            isOneToOne: false
            referencedRelation: "job_link"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "upload_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_account"
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
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_group: {
        Row: {
          audience: Database["public"]["Enums"]["message_audience"]
          created_at: string
          description: string | null
          error: string | null
          external_id: string | null
          id: string
          invite_url: string | null
          participant_count: number
          project_id: string
          service_window_expires_at: string | null
          state: Database["public"]["Enums"]["whatsapp_group_state"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          audience: Database["public"]["Enums"]["message_audience"]
          created_at?: string
          description?: string | null
          error?: string | null
          external_id?: string | null
          id?: string
          invite_url?: string | null
          participant_count?: number
          project_id: string
          service_window_expires_at?: string | null
          state?: Database["public"]["Enums"]["whatsapp_group_state"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["message_audience"]
          created_at?: string
          description?: string | null
          error?: string | null
          external_id?: string | null
          id?: string
          invite_url?: string | null
          participant_count?: number
          project_id?: string
          service_window_expires_at?: string | null
          state?: Database["public"]["Enums"]["whatsapp_group_state"]
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
    }
    Views: {
      v_agent_rule_performance: {
        Row: {
          accept_rate: number | null
          accepted: number | null
          dismissed: number | null
          rule_key: string | null
          total: number | null
        }
        Relationships: []
      }
      v_bid_board: {
        Row: {
          amount: number | null
          bid_request_id: string | null
          due_at: string | null
          first_opened_at: string | null
          invite_state: string | null
          job_address: string | null
          lead_time_days: number | null
          partner_id: string | null
          partner_name: string | null
          project_code: string | null
          project_id: string | null
          scope: Database["public"]["Enums"]["bid_scope"] | null
          status: Database["public"]["Enums"]["bid_request_status"] | null
          submitted_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_request_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_request_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
      v_needs_attention: {
        Row: {
          client_name: string | null
          confidence: number | null
          created_at: string | null
          detail: string | null
          headline: string | null
          job_address: string | null
          project_code: string | null
          project_id: string | null
          proposed_action: Json | null
          rule_key: string | null
          said_at: string | null
          said_by: string | null
          source_message: string | null
          suggestion_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_today_schedule"
            referencedColumns: ["project_id"]
          },
        ]
      }
      v_open_receivables: {
        Row: {
          aging_bucket: string | null
          amount: number | null
          amount_paid: number | null
          balance: number | null
          client_name: string | null
          days_overdue: number | null
          due_at: string | null
          id: string | null
          issued_at: string | null
          job_address: string | null
          number: string | null
          project_code: string | null
        }
        Relationships: []
      }
      v_today_schedule: {
        Row: {
          client_name: string | null
          crew_name: string | null
          crew_notified: boolean | null
          job_address: string | null
          project_code: string | null
          project_id: string | null
          rep_name: string | null
          rep_notified: boolean | null
          scheduled_date: string | null
          slot: Database["public"]["Enums"]["time_slot"] | null
          start_time: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_id: string | null
          task_type: Database["public"]["Enums"]["task_type"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_owner: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      portal_get_bid: { Args: { p_token: string }; Returns: Json }
      portal_get_job: { Args: { p_token: string }; Returns: Json }
      portal_submit_bid: {
        Args: {
          p_amount: number
          p_lead?: number
          p_notes?: string
          p_token: string
        }
        Returns: boolean
      }
      portal_submit_upload: {
        Args: { p_note: string; p_tag: string; p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      approval_channel: "whatsapp" | "email" | "phone" | "in_person" | "portal"
      bid_request_status: "draft" | "open" | "closed" | "canceled"
      bid_scope:
        | "cabinets"
        | "countertops"
        | "cabinets_and_countertops"
        | "install_only"
        | "full_job"
        | "demo"
        | "other"
      bid_status: "submitted" | "declined" | "withdrawn"
      change_order_status: "pending" | "approved" | "declined" | "canceled"
      claim_type:
        | "status"
        | "schedule"
        | "inspection"
        | "extra_work"
        | "approval"
        | "problem"
        | "money"
        | "question"
        | "other"
      design_source: "in_house" | "client_supplied"
      inspection_result: "pending" | "passed" | "failed" | "canceled"
      inspection_type: "plumbing" | "electrical" | "framing" | "final" | "other"
      invoice_status: "draft" | "sent" | "partial" | "paid" | "overdue" | "void"
      job_type: "undecided" | "full_remodel" | "install_only"
      margin_type: "percent" | "amount"
      message_audience: "client_rep" | "crew" | "partner" | "internal"
      message_channel: "whatsapp_manual" | "whatsapp_api" | "sms" | "email"
      message_direction: "outbound" | "inbound"
      message_status:
        | "draft"
        | "approved"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "canceled"
      milestone_status: "pending" | "reached" | "invoiced" | "paid" | "skipped"
      milestone_trigger:
        | "design_dispatched"
        | "design_complete"
        | "demo_complete"
        | "rough_in_complete"
        | "inspection_passed"
        | "cabinets_installed"
        | "countertops_installed"
        | "job_complete"
        | "manual"
      partner_type:
        | "cabinet_vendor"
        | "countertop_vendor"
        | "install_crew"
        | "full_service_crew"
        | "designer"
        | "other"
      payout_status: "pending" | "approved" | "paid" | "canceled"
      project_status:
        | "intake"
        | "design_scheduled"
        | "design_complete"
        | "bidding"
        | "quoted"
        | "won"
        | "lost"
        | "scheduled"
        | "in_progress"
        | "complete"
        | "closed"
        | "on_hold"
      quote_status: "draft" | "sent" | "approved" | "declined" | "superseded"
      suggestion_status: "open" | "accepted" | "dismissed" | "expired"
      task_status:
        | "unscheduled"
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "done"
        | "blocked"
        | "canceled"
      task_type:
        | "design_visit"
        | "demo"
        | "plumbing_rough"
        | "electrical_rough"
        | "inspection"
        | "cabinet_delivery"
        | "cabinet_install"
        | "countertop_template"
        | "countertop_install"
        | "punch_list"
        | "rework"
        | "other"
      time_slot: "am" | "pm" | "full_day"
      upload_tag: "progress" | "problem" | "extra_work" | "complete" | "other"
      user_role: "owner" | "logger"
      whatsapp_group_state: "pending" | "active" | "archived" | "failed"
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
      approval_channel: ["whatsapp", "email", "phone", "in_person", "portal"],
      bid_request_status: ["draft", "open", "closed", "canceled"],
      bid_scope: [
        "cabinets",
        "countertops",
        "cabinets_and_countertops",
        "install_only",
        "full_job",
        "demo",
        "other",
      ],
      bid_status: ["submitted", "declined", "withdrawn"],
      change_order_status: ["pending", "approved", "declined", "canceled"],
      claim_type: [
        "status",
        "schedule",
        "inspection",
        "extra_work",
        "approval",
        "problem",
        "money",
        "question",
        "other",
      ],
      design_source: ["in_house", "client_supplied"],
      inspection_result: ["pending", "passed", "failed", "canceled"],
      inspection_type: ["plumbing", "electrical", "framing", "final", "other"],
      invoice_status: ["draft", "sent", "partial", "paid", "overdue", "void"],
      job_type: ["undecided", "full_remodel", "install_only"],
      margin_type: ["percent", "amount"],
      message_audience: ["client_rep", "crew", "partner", "internal"],
      message_channel: ["whatsapp_manual", "whatsapp_api", "sms", "email"],
      message_direction: ["outbound", "inbound"],
      message_status: [
        "draft",
        "approved",
        "sent",
        "delivered",
        "read",
        "failed",
        "canceled",
      ],
      milestone_status: ["pending", "reached", "invoiced", "paid", "skipped"],
      milestone_trigger: [
        "design_dispatched",
        "design_complete",
        "demo_complete",
        "rough_in_complete",
        "inspection_passed",
        "cabinets_installed",
        "countertops_installed",
        "job_complete",
        "manual",
      ],
      partner_type: [
        "cabinet_vendor",
        "countertop_vendor",
        "install_crew",
        "full_service_crew",
        "designer",
        "other",
      ],
      payout_status: ["pending", "approved", "paid", "canceled"],
      project_status: [
        "intake",
        "design_scheduled",
        "design_complete",
        "bidding",
        "quoted",
        "won",
        "lost",
        "scheduled",
        "in_progress",
        "complete",
        "closed",
        "on_hold",
      ],
      quote_status: ["draft", "sent", "approved", "declined", "superseded"],
      suggestion_status: ["open", "accepted", "dismissed", "expired"],
      task_status: [
        "unscheduled",
        "scheduled",
        "confirmed",
        "in_progress",
        "done",
        "blocked",
        "canceled",
      ],
      task_type: [
        "design_visit",
        "demo",
        "plumbing_rough",
        "electrical_rough",
        "inspection",
        "cabinet_delivery",
        "cabinet_install",
        "countertop_template",
        "countertop_install",
        "punch_list",
        "rework",
        "other",
      ],
      time_slot: ["am", "pm", "full_day"],
      upload_tag: ["progress", "problem", "extra_work", "complete", "other"],
      user_role: ["owner", "logger"],
      whatsapp_group_state: ["pending", "active", "archived", "failed"],
    },
  },
} as const
