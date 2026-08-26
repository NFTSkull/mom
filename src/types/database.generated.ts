export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      action_plans: {
        Row: {
          action_level: Database["public"]["Enums"]["action_level"]
          action_type: Database["public"]["Enums"]["action_type"]
          archived_at: string | null
          area: string
          campaign_id: string
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          follow_up_notes: string
          id: string
          responsible: string
          risk_factor: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          source: string
          source_key: string | null
          status: Database["public"]["Enums"]["action_status"]
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          action_level: Database["public"]["Enums"]["action_level"]
          action_type: Database["public"]["Enums"]["action_type"]
          archived_at?: string | null
          area: string
          campaign_id: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          follow_up_notes?: string
          id?: string
          responsible: string
          risk_factor: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          source?: string
          source_key?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          action_level?: Database["public"]["Enums"]["action_level"]
          action_type?: Database["public"]["Enums"]["action_type"]
          archived_at?: string | null
          area?: string
          campaign_id?: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          follow_up_notes?: string
          id?: string
          responsible?: string
          risk_factor?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          source?: string
          source_key?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "evaluation_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_profiles: {
        Row: {
          active: boolean
          can_view_sensitive_cases: boolean
          created_at: string
          deactivated_at: string | null
          email: string
          id: string
          invited_by: string | null
          last_login_at: string | null
          mfa_required: boolean
          must_change_password: boolean
          nombre: string
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          can_view_sensitive_cases?: boolean
          created_at?: string
          deactivated_at?: string | null
          email: string
          id: string
          invited_by?: string | null
          last_login_at?: string | null
          mfa_required?: boolean
          must_change_password?: boolean
          nombre: string
          role: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          can_view_sensitive_cases?: boolean
          created_at?: string
          deactivated_at?: string | null
          email?: string
          id?: string
          invited_by?: string | null
          last_login_at?: string | null
          mfa_required?: boolean
          must_change_password?: boolean
          nombre?: string
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      assignment_questionnaires: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          last_saved_at: string | null
          questionnaire_type: string
          questionnaire_version: string
          started_at: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          last_saved_at?: string | null
          questionnaire_type: string
          questionnaire_version: string
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          last_saved_at?: string | null
          questionnaire_type?: string
          questionnaire_version?: string
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_questionnaires_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "evaluation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          actividad_principal: string | null
          created_at: string
          domicilio: string | null
          id: string
          razon_social: string
          responsable_email: string | null
          responsable_nombre: string | null
          responsable_telefono: string | null
          rfc: string | null
          singleton_lock: boolean
          telefono: string | null
          total_trabajadores: number
          updated_at: string
        }
        Insert: {
          actividad_principal?: string | null
          created_at?: string
          domicilio?: string | null
          id?: string
          razon_social: string
          responsable_email?: string | null
          responsable_nombre?: string | null
          responsable_telefono?: string | null
          rfc?: string | null
          singleton_lock?: boolean
          telefono?: string | null
          total_trabajadores: number
          updated_at?: string
        }
        Update: {
          actividad_principal?: string | null
          created_at?: string
          domicilio?: string | null
          id?: string
          razon_social?: string
          responsable_email?: string | null
          responsable_nombre?: string | null
          responsable_telefono?: string | null
          rfc?: string | null
          singleton_lock?: boolean
          telefono?: string | null
          total_trabajadores?: number
          updated_at?: string
        }
        Relationships: []
      }
      confidential_complaints: {
        Row: {
          assigned_at: string | null
          assigned_label: string | null
          assigned_to: string | null
          closed_at: string | null
          complaint_type: Database["public"]["Enums"]["complaint_type"]
          confirmation_code: string
          created_at: string
          description: string
          folio: string
          id: string
          is_anonymous: boolean
          public_submission_id: string
          reporter_contact: string | null
          reporter_name: string | null
          resolution_category: string | null
          resolution_notes: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          updated_at: string
          version: number
        }
        Insert: {
          assigned_at?: string | null
          assigned_label?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          complaint_type: Database["public"]["Enums"]["complaint_type"]
          confirmation_code?: string
          created_at?: string
          description: string
          folio: string
          id?: string
          is_anonymous?: boolean
          public_submission_id?: string
          reporter_contact?: string | null
          reporter_name?: string | null
          resolution_category?: string | null
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          assigned_at?: string | null
          assigned_label?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          complaint_type?: Database["public"]["Enums"]["complaint_type"]
          confirmation_code?: string
          created_at?: string
          description?: string
          folio?: string
          id?: string
          is_anonymous?: boolean
          public_submission_id?: string
          reporter_contact?: string | null
          reporter_name?: string | null
          resolution_category?: string | null
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      evaluation_answers: {
        Row: {
          answer_text: string | null
          answer_value: string | null
          assignment_id: string
          created_at: string
          id: string
          question_id: string
          questionnaire_code: string
        }
        Insert: {
          answer_text?: string | null
          answer_value?: string | null
          assignment_id: string
          created_at?: string
          id?: string
          question_id: string
          questionnaire_code: string
        }
        Update: {
          answer_text?: string | null
          answer_value?: string | null
          assignment_id?: string
          created_at?: string
          id?: string
          question_id?: string
          questionnaire_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_answers_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "evaluation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_assignments: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          questionnaire_version: string
          revoked_at: string | null
          revoked_reason: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          token_hash: string
          token_issued_at: string | null
          token_last4: string
          token_rotated_at: string | null
          updated_at: string
          updated_by: string | null
          worker_id: string
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          questionnaire_version?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          token_hash: string
          token_issued_at?: string | null
          token_last4: string
          token_rotated_at?: string | null
          updated_at?: string
          updated_by?: string | null
          worker_id: string
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          questionnaire_version?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          token_hash?: string
          token_issued_at?: string | null
          token_last4?: string
          token_rotated_at?: string | null
          updated_at?: string
          updated_by?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "evaluation_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_campaigns: {
        Row: {
          activated_at: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          fecha_cierre: string | null
          fecha_inicio: string | null
          id: string
          nombre: string
          questionnaire_version: string
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activated_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          fecha_cierre?: string | null
          fecha_inicio?: string | null
          id?: string
          nombre: string
          questionnaire_version?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activated_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          fecha_cierre?: string | null
          fecha_inicio?: string | null
          id?: string
          nombre?: string
          questionnaire_version?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      evaluation_drafts: {
        Row: {
          assignment_id: string
          created_at: string
          payload: Json
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          payload?: Json
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_drafts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "evaluation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_results: {
        Row: {
          alerts: Json
          assignment_id: string
          campaign_id: string
          completed_at: string
          created_at: string
          guia_i_requires_clinical_attention: boolean
          guia_i_risk_label: string | null
          guia_ii_category_scores: Json
          guia_ii_dimension_scores: Json
          guia_ii_domain_scores: Json
          guia_ii_final_risk_level:
            | Database["public"]["Enums"]["risk_level"]
            | null
          guia_ii_final_score: number | null
          id: string
          questionnaire_version: string
          result_snapshot: Json
          scoring_version: string
          submission_id: string
          validation_warnings: Json
          worker_id: string
        }
        Insert: {
          alerts?: Json
          assignment_id: string
          campaign_id: string
          completed_at: string
          created_at?: string
          guia_i_requires_clinical_attention?: boolean
          guia_i_risk_label?: string | null
          guia_ii_category_scores?: Json
          guia_ii_dimension_scores?: Json
          guia_ii_domain_scores?: Json
          guia_ii_final_risk_level?:
            | Database["public"]["Enums"]["risk_level"]
            | null
          guia_ii_final_score?: number | null
          id?: string
          questionnaire_version?: string
          result_snapshot?: Json
          scoring_version: string
          submission_id: string
          validation_warnings?: Json
          worker_id: string
        }
        Update: {
          alerts?: Json
          assignment_id?: string
          campaign_id?: string
          completed_at?: string
          created_at?: string
          guia_i_requires_clinical_attention?: boolean
          guia_i_risk_label?: string | null
          guia_ii_category_scores?: Json
          guia_ii_dimension_scores?: Json
          guia_ii_domain_scores?: Json
          guia_ii_final_risk_level?:
            | Database["public"]["Enums"]["risk_level"]
            | null
          guia_ii_final_score?: number | null
          id?: string
          questionnaire_version?: string
          result_snapshot?: Json
          scoring_version?: string
          submission_id?: string
          validation_warnings?: Json
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "evaluation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_results_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "evaluation_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_results_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_sessions: {
        Row: {
          assignment_id: string
          created_at: string
          expires_at: string
          id: string
          last_seen_at: string
          revoked_at: string | null
          session_hash: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          expires_at: string
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          session_hash: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          session_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_sessions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "evaluation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_items: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          evidence_source: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          external_url: string | null
          id: string
          mime_type: string | null
          notes: string | null
          original_file_name: string | null
          replaced_by_id: string | null
          safe_file_name: string | null
          sha256: string | null
          size_bytes: number | null
          storage_bucket: string | null
          storage_delete_pending: boolean
          storage_path: string | null
          supersedes_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description: string
          evidence_source: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          external_url?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_file_name?: string | null
          replaced_by_id?: string | null
          safe_file_name?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_delete_pending?: boolean
          storage_path?: string | null
          supersedes_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          evidence_source?: string
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          external_url?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_file_name?: string | null
          replaced_by_id?: string | null
          safe_file_name?: string | null
          sha256?: string | null
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_delete_pending?: boolean
          storage_path?: string | null
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "evidence_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "evaluation_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_items_replaced_by_id_fkey"
            columns: ["replaced_by_id"]
            isOneToOne: false
            referencedRelation: "evidence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_items_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "evidence_items"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_documents: {
        Row: {
          archived_at: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          status: Database["public"]["Enums"]["policy_status"]
          supersedes_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: string
          version_label: string
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["policy_status"]
          supersedes_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version: string
          version_label?: string
          version_number?: number
        }
        Update: {
          archived_at?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["policy_status"]
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: string
          version_label?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "policy_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      public_rate_limits: {
        Row: {
          action: string
          key_hash: string
          request_count: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          action: string
          key_hash: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          action?: string
          key_hash?: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission: Database["public"]["Enums"]["app_permission"]
          requires_aal2: boolean
          requires_sensitive_access: boolean
          role: Database["public"]["Enums"]["admin_role"]
        }
        Insert: {
          created_at?: string
          permission: Database["public"]["Enums"]["app_permission"]
          requires_aal2?: boolean
          requires_sensitive_access?: boolean
          role: Database["public"]["Enums"]["admin_role"]
        }
        Update: {
          created_at?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          requires_aal2?: boolean
          requires_sensitive_access?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
        }
        Relationships: []
      }
      worker_accounts: {
        Row: {
          auth_user_id: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          last_login_at: string | null
          must_change_password: boolean
          updated_at: string
          username_normalized: string
          worker_id: string
        }
        Insert: {
          auth_user_id: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          must_change_password?: boolean
          updated_at?: string
          username_normalized: string
          worker_id: string
        }
        Update: {
          auth_user_id?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          must_change_password?: boolean
          updated_at?: string
          username_normalized?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_accounts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          activo: boolean
          antiguedad: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          departamento: string | null
          email: string | null
          external_reference: string | null
          id: string
          is_test: boolean
          jefe_directo: string | null
          nombre: string
          normalized_email: string | null
          normalized_phone: string | null
          puesto: string | null
          sucursal: string | null
          telefono: string | null
          turno: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          antiguedad?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          departamento?: string | null
          email?: string | null
          external_reference?: string | null
          id?: string
          is_test?: boolean
          jefe_directo?: string | null
          nombre: string
          normalized_email?: string | null
          normalized_phone?: string | null
          puesto?: string | null
          sucursal?: string | null
          telefono?: string | null
          turno?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          antiguedad?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          departamento?: string | null
          email?: string | null
          external_reference?: string | null
          id?: string
          is_test?: boolean
          jefe_directo?: string | null
          nombre?: string
          normalized_email?: string | null
          normalized_phone?: string | null
          puesto?: string | null
          sucursal?: string | null
          telefono?: string | null
          turno?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_action_plan_summary: {
        Args: { p_campaign_id?: string }
        Returns: Json
      }
      admin_action_plan_to_json: {
        Args: { p: Database["public"]["Tables"]["action_plans"]["Row"] }
        Returns: Json
      }
      admin_activate_campaign: {
        Args: { p_campaign_id: string }
        Returns: Json
      }
      admin_archive_action_plan: { Args: { p_id: string }; Returns: Json }
      admin_archive_policy: { Args: { p_id: string }; Returns: Json }
      admin_assign_complaint: {
        Args: { p_assigned_label: string; p_id: string }
        Returns: Json
      }
      admin_campaign_to_json: {
        Args: { p: Database["public"]["Tables"]["evaluation_campaigns"]["Row"] }
        Returns: Json
      }
      admin_change_action_plan_status: {
        Args: { p_id: string; p_status: string }
        Returns: Json
      }
      admin_change_complaint_status: {
        Args: { p_id: string; p_status: string }
        Returns: Json
      }
      admin_close_campaign: { Args: { p_campaign_id: string }; Returns: Json }
      admin_close_complaint: {
        Args: { p_id: string; p_justification?: string }
        Returns: Json
      }
      admin_complaint_list_to_json: {
        Args: {
          p: Database["public"]["Tables"]["confidential_complaints"]["Row"]
        }
        Returns: Json
      }
      admin_complaint_summary: { Args: never; Returns: Json }
      admin_create_action_plan: {
        Args: {
          p_action_level: string
          p_action_type: string
          p_area: string
          p_campaign_id: string
          p_description: string
          p_due_date?: string
          p_follow_up_notes?: string
          p_responsible: string
          p_risk_factor: string
          p_risk_level: string
          p_source?: string
          p_source_key?: string
        }
        Returns: Json
      }
      admin_create_campaign: {
        Args: {
          p_descripcion?: string
          p_fecha_cierre?: string
          p_fecha_inicio?: string
          p_nombre: string
          p_questionnaire_version?: string
        }
        Returns: Json
      }
      admin_create_evidence_metadata: {
        Args: {
          p_campaign_id?: string
          p_description: string
          p_evidence_source: string
          p_evidence_type: string
          p_external_url?: string
          p_mime_type?: string
          p_notes?: string
          p_original_file_name?: string
          p_safe_file_name?: string
          p_sha256?: string
          p_size_bytes?: number
          p_storage_bucket?: string
          p_storage_path?: string
          p_title: string
        }
        Returns: Json
      }
      admin_create_policy_draft: {
        Args: {
          p_content: string
          p_supersedes_id?: string
          p_title: string
          p_version_label?: string
        }
        Returns: Json
      }
      admin_create_worker: {
        Args: {
          p_activo?: boolean
          p_antiguedad?: string
          p_departamento?: string
          p_email?: string
          p_external_reference?: string
          p_jefe_directo?: string
          p_nombre: string
          p_puesto?: string
          p_sucursal?: string
          p_telefono?: string
          p_turno?: string
        }
        Returns: Json
      }
      admin_dashboard_summary: { Args: never; Returns: Json }
      admin_deactivate_admin_profile: { Args: { p_id: string }; Returns: Json }
      admin_deactivate_worker: { Args: { p_worker_id: string }; Returns: Json }
      admin_delete_worker: { Args: { p_worker_id: string }; Returns: Json }
      admin_duplicate_policy: {
        Args: { p_id: string; p_version_label?: string }
        Returns: Json
      }
      admin_evidence_summary: { Args: never; Returns: Json }
      admin_evidence_to_json: {
        Args: { p: Database["public"]["Tables"]["evidence_items"]["Row"] }
        Returns: Json
      }
      admin_export_nom035_avance: { Args: never; Returns: Json }
      admin_export_nom035_full_report: { Args: never; Returns: Json }
      admin_force_worker_password_change: {
        Args: { p_worker_id: string }
        Returns: Json
      }
      admin_generate_suggested_action_plans: {
        Args: {
          p_campaign_id: string
          p_domain_map: Json
          p_due_days?: number
          p_guia_i?: Json
          p_guia_i_due_days?: number
          p_responsible?: string
        }
        Returns: Json
      }
      admin_get_company_settings: { Args: never; Returns: Json }
      admin_get_complaint_detail: { Args: { p_id: string }; Returns: Json }
      admin_get_evidence_detail: { Args: { p_id: string }; Returns: Json }
      admin_get_my_auth_context: { Args: never; Returns: Json }
      admin_get_policy: { Args: { p_id: string }; Returns: Json }
      admin_get_result_detail: { Args: { p_result_id: string }; Returns: Json }
      admin_import_workers: {
        Args: { p_mode?: string; p_rows: Json }
        Returns: Json
      }
      admin_issue_assignment: {
        Args: {
          p_campaign_id: string
          p_expires_at: string
          p_questionnaire_version: string
          p_token_hash: string
          p_token_last4: string
          p_worker_id: string
        }
        Returns: Json
      }
      admin_issue_assignments_batch: {
        Args: {
          p_campaign_id: string
          p_items: Json
          p_questionnaire_version?: string
        }
        Returns: Json
      }
      admin_list_action_plans: {
        Args: {
          p_campaign_id?: string
          p_include_archived?: boolean
          p_page?: number
          p_page_size?: number
          p_source?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_list_audit_log: {
        Args: {
          p_action?: string
          p_actor?: string
          p_entity_type?: string
          p_limit?: number
        }
        Returns: Json
      }
      admin_list_campaign_assignments: {
        Args: {
          p_campaign_id: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_list_campaigns: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_list_complaints: {
        Args: {
          p_complaint_type?: string
          p_folio?: string
          p_page?: number
          p_page_size?: number
          p_status?: string
        }
        Returns: Json
      }
      admin_list_evidence: {
        Args: {
          p_evidence_type?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_state?: string
        }
        Returns: Json
      }
      admin_list_missing_assignment_workers: {
        Args: { p_campaign_id: string }
        Returns: Json
      }
      admin_list_policies: {
        Args: { p_page?: number; p_page_size?: number }
        Returns: Json
      }
      admin_list_results: {
        Args: {
          p_campaign_id?: string
          p_departamento?: string
          p_page?: number
          p_page_size?: number
          p_risk_level?: string
          p_search?: string
          p_worker_id?: string
        }
        Returns: Json
      }
      admin_list_users: { Args: never; Returns: Json }
      admin_list_workers: {
        Args: {
          p_activo?: boolean
          p_departamento?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
        }
        Returns: Json
      }
      admin_mark_evidence_cleanup_pending: {
        Args: { p_id: string }
        Returns: Json
      }
      admin_mark_evidence_storage_deleted: {
        Args: { p_id: string }
        Returns: Json
      }
      admin_policy_summary: { Args: never; Returns: Json }
      admin_policy_to_json: {
        Args: { p: Database["public"]["Tables"]["policy_documents"]["Row"] }
        Returns: Json
      }
      admin_publish_policy: { Args: { p_id: string }; Returns: Json }
      admin_reactivate_admin_profile: { Args: { p_id: string }; Returns: Json }
      admin_reactivate_worker: { Args: { p_worker_id: string }; Returns: Json }
      admin_replace_evidence_metadata: {
        Args: {
          p_mime_type: string
          p_old_id: string
          p_original_file_name: string
          p_safe_file_name: string
          p_sha256: string
          p_size_bytes: number
          p_storage_bucket: string
          p_storage_path: string
        }
        Returns: Json
      }
      admin_reports_summary: {
        Args: { p_campaign_id?: string; p_departamento?: string }
        Returns: Json
      }
      admin_reset_worker_access: {
        Args: { p_worker_id: string }
        Returns: Json
      }
      admin_resolve_complaint: {
        Args: { p_category?: string; p_id: string; p_notes?: string }
        Returns: Json
      }
      admin_resolve_worker_login: {
        Args: { p_username: string }
        Returns: Json
      }
      admin_revoke_assignment: {
        Args: { p_assignment_id: string; p_reason?: string }
        Returns: Json
      }
      admin_rotate_assignment_token: {
        Args: {
          p_assignment_id: string
          p_expires_at: string
          p_token_hash: string
          p_token_last4: string
        }
        Returns: Json
      }
      admin_set_worker_account_active: {
        Args: { p_active: boolean; p_worker_id: string }
        Returns: Json
      }
      admin_soft_delete_evidence: { Args: { p_id: string }; Returns: Json }
      admin_touch_last_login: { Args: never; Returns: Json }
      admin_update_action_plan: {
        Args: {
          p_action_level?: string
          p_action_type?: string
          p_area?: string
          p_clear_due_date?: boolean
          p_description?: string
          p_due_date?: string
          p_follow_up_notes?: string
          p_id: string
          p_responsible?: string
          p_risk_factor?: string
          p_risk_level?: string
        }
        Returns: Json
      }
      admin_update_campaign: {
        Args: {
          p_campaign_id: string
          p_descripcion?: string
          p_fecha_cierre?: string
          p_fecha_inicio?: string
          p_nombre?: string
        }
        Returns: Json
      }
      admin_update_evidence_metadata: {
        Args: {
          p_description?: string
          p_evidence_type?: string
          p_id: string
          p_notes?: string
          p_title?: string
        }
        Returns: Json
      }
      admin_update_policy_draft: {
        Args: {
          p_content?: string
          p_id: string
          p_title?: string
          p_version_label?: string
        }
        Returns: Json
      }
      admin_update_worker: {
        Args: {
          p_antiguedad?: string
          p_departamento?: string
          p_email?: string
          p_external_reference?: string
          p_jefe_directo?: string
          p_nombre?: string
          p_puesto?: string
          p_sucursal?: string
          p_telefono?: string
          p_turno?: string
          p_worker_id: string
        }
        Returns: Json
      }
      admin_upsert_admin_profile: {
        Args: {
          p_active?: boolean
          p_can_view_sensitive_cases?: boolean
          p_email: string
          p_id: string
          p_mfa_required?: boolean
          p_nombre: string
          p_role: Database["public"]["Enums"]["admin_role"]
        }
        Returns: Json
      }
      admin_upsert_company_settings: {
        Args: {
          p_actividad_principal?: string
          p_domicilio?: string
          p_razon_social: string
          p_responsable_email?: string
          p_responsable_nombre?: string
          p_responsable_telefono?: string
          p_rfc?: string
          p_telefono?: string
          p_total_trabajadores?: number
        }
        Returns: Json
      }
      admin_worker_portal_status: {
        Args: { p_worker_id: string }
        Returns: Json
      }
      admin_worker_to_json: {
        Args: { p: Database["public"]["Tables"]["workers"]["Row"] }
        Returns: Json
      }
      build_public_assignment_context: {
        Args: { p_assignment_id: string }
        Returns: Json
      }
      check_assignment_usable: {
        Args: {
          p_assignment: Database["public"]["Tables"]["evaluation_assignments"]["Row"]
        }
        Returns: string
      }
      consume_public_rate_limit: {
        Args: {
          p_action: string
          p_key_hash: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: Json
      }
      count_active_admins: { Args: never; Returns: number }
      create_public_evaluation_assignment: {
        Args: {
          p_campaign_id: string
          p_expires_at: string
          p_questionnaire_version: string
          p_token_hash: string
          p_token_last4: string
          p_worker_id: string
        }
        Returns: Json
      }
      current_admin_profile: {
        Args: never
        Returns: {
          active: boolean
          can_view_sensitive_cases: boolean
          created_at: string
          deactivated_at: string | null
          email: string
          id: string
          invited_by: string | null
          last_login_at: string | null
          mfa_required: boolean
          must_change_password: boolean
          nombre: string
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          updated_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "admin_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_admin_role: {
        Args: never
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      current_worker_account: {
        Args: never
        Returns: {
          auth_user_id: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          last_login_at: string | null
          must_change_password: boolean
          updated_at: string
          username_normalized: string
          worker_id: string
        }
        SetofOptions: {
          from: "*"
          to: "worker_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_assignment_questionnaires: {
        Args: { p_assignment_id: string }
        Returns: undefined
      }
      exchange_evaluation_token: {
        Args: {
          p_session_expires_at: string
          p_session_hash: string
          p_token_hash: string
        }
        Returns: Json
      }
      get_evaluation_session_context: {
        Args: { p_session_hash: string }
        Returns: Json
      }
      has_admin_permission: {
        Args: { p_permission: Database["public"]["Enums"]["app_permission"] }
        Returns: boolean
      }
      is_active_admin_user: { Args: never; Returns: boolean }
      nom035_current_aal: { Args: never; Returns: string }
      nom035_is_supported_questionnaire_version: {
        Args: { p: string }
        Returns: boolean
      }
      nom035_is_valid_email: { Args: { p: string }; Returns: boolean }
      nom035_jwt_role: { Args: never; Returns: string }
      nom035_next_complaint_folio: { Args: never; Returns: string }
      nom035_normalize_email: { Args: { p: string }; Returns: string }
      nom035_normalize_phone: { Args: { p: string }; Returns: string }
      nom035_normalize_username: { Args: { p: string }; Returns: string }
      nom035_nullif_blank: { Args: { p: string }; Returns: string }
      nom035_write_auth_audit: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      open_evaluation_session_for_worker: {
        Args: {
          p_session_expires_at: string
          p_session_hash: string
          p_worker_id: string
        }
        Returns: Json
      }
      public_submit_confidential_complaint: {
        Args: {
          p_complaint_type: string
          p_description: string
          p_is_anonymous: boolean
          p_reporter_contact?: string
          p_reporter_name?: string
        }
        Returns: Json
      }
      require_admin_permission: {
        Args: { p_permission: Database["public"]["Enums"]["app_permission"] }
        Returns: undefined
      }
      require_admin_permission_aal2: {
        Args: { p_permission: Database["public"]["Enums"]["app_permission"] }
        Returns: undefined
      }
      resolve_active_session: {
        Args: { p_session_hash: string }
        Returns: {
          assignment_id: string
          created_at: string
          expires_at: string
          id: string
          last_seen_at: string
          revoked_at: string | null
          session_hash: string
        }
        SetofOptions: {
          from: "*"
          to: "evaluation_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_public_evaluation_draft: {
        Args: {
          p_expected_updated_at?: string
          p_payload: Json
          p_session_hash: string
        }
        Returns: Json
      }
      start_public_evaluation: {
        Args: { p_session_hash: string }
        Returns: Json
      }
      submit_public_evaluation: {
        Args: {
          p_answers: Json
          p_calculated_at: string
          p_questionnaire_version: string
          p_result: Json
          p_scoring_version: string
          p_session_hash: string
          p_submission_id: string
        }
        Returns: Json
      }
      sync_assignment_instruments_from_draft: {
        Args: { p_assignment_id: string; p_payload: Json }
        Returns: undefined
      }
      worker_clear_must_change_password: {
        Args: { p_auth_user_id: string }
        Returns: Json
      }
      worker_get_portal_state: { Args: never; Returns: Json }
      worker_mark_login: { Args: { p_auth_user_id: string }; Returns: Json }
    }
    Enums: {
      action_level: "primer_nivel" | "segundo_nivel" | "tercer_nivel"
      action_status: "pendiente" | "en_proceso" | "completada" | "cancelada"
      action_type: "organizacional" | "grupal" | "individual_confidencial"
      admin_role: "admin" | "rh" | "psicologo" | "direccion"
      app_permission:
        | "dashboard.view"
        | "company.read"
        | "company.write"
        | "workers.read"
        | "workers.write"
        | "workers.import"
        | "campaigns.read"
        | "campaigns.write"
        | "assignments.issue"
        | "assignments.rotate"
        | "assignments.revoke"
        | "results.aggregate.read"
        | "results.individual.read"
        | "results.answers.read"
        | "results.clinical.read"
        | "reports.generate"
        | "action_plans.read"
        | "action_plans.write"
        | "evidence.read"
        | "evidence.write"
        | "evidence.download"
        | "complaints.list"
        | "complaints.detail"
        | "complaints.contact.read"
        | "complaints.manage"
        | "policies.read"
        | "policies.write"
        | "policies.publish"
        | "users.read"
        | "users.manage"
        | "audit.read"
      assignment_status: "pending" | "in_progress" | "completed" | "revoked"
      campaign_status: "draft" | "active" | "closed"
      complaint_status: "recibida" | "en_revision" | "resuelta" | "cerrada"
      complaint_type:
        | "violencia_laboral"
        | "entorno_organizacional"
        | "factores_riesgo_psicosocial"
        | "otro"
      evidence_type:
        | "politica"
        | "difusion"
        | "resultados"
        | "reporte"
        | "capacitacion"
        | "plan_accion"
        | "quejas"
        | "canalizacion"
        | "otro"
      policy_status: "borrador" | "publicada" | "archivada"
      risk_level: "nulo" | "bajo" | "medio" | "alto" | "muy_alto"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      action_level: ["primer_nivel", "segundo_nivel", "tercer_nivel"],
      action_status: ["pendiente", "en_proceso", "completada", "cancelada"],
      action_type: ["organizacional", "grupal", "individual_confidencial"],
      admin_role: ["admin", "rh", "psicologo", "direccion"],
      app_permission: [
        "dashboard.view",
        "company.read",
        "company.write",
        "workers.read",
        "workers.write",
        "workers.import",
        "campaigns.read",
        "campaigns.write",
        "assignments.issue",
        "assignments.rotate",
        "assignments.revoke",
        "results.aggregate.read",
        "results.individual.read",
        "results.answers.read",
        "results.clinical.read",
        "reports.generate",
        "action_plans.read",
        "action_plans.write",
        "evidence.read",
        "evidence.write",
        "evidence.download",
        "complaints.list",
        "complaints.detail",
        "complaints.contact.read",
        "complaints.manage",
        "policies.read",
        "policies.write",
        "policies.publish",
        "users.read",
        "users.manage",
        "audit.read",
      ],
      assignment_status: ["pending", "in_progress", "completed", "revoked"],
      campaign_status: ["draft", "active", "closed"],
      complaint_status: ["recibida", "en_revision", "resuelta", "cerrada"],
      complaint_type: [
        "violencia_laboral",
        "entorno_organizacional",
        "factores_riesgo_psicosocial",
        "otro",
      ],
      evidence_type: [
        "politica",
        "difusion",
        "resultados",
        "reporte",
        "capacitacion",
        "plan_accion",
        "quejas",
        "canalizacion",
        "otro",
      ],
      policy_status: ["borrador", "publicada", "archivada"],
      risk_level: ["nulo", "bajo", "medio", "alto", "muy_alto"],
    },
  },
} as const

