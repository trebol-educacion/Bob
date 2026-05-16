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
      bob_generation_cache: {
        Row: {
          cache_key: string
          created_at: string
          hit_count: number
          inputs: Json
          kind: string
          last_hit_at: string | null
          output_blob_url: string | null
          output_json: Json | null
          output_text: string | null
          prompt_key: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          hit_count?: number
          inputs: Json
          kind: string
          last_hit_at?: string | null
          output_blob_url?: string | null
          output_json?: Json | null
          output_text?: string | null
          prompt_key: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          hit_count?: number
          inputs?: Json
          kind?: string
          last_hit_at?: string | null
          output_blob_url?: string | null
          output_json?: Json | null
          output_text?: string | null
          prompt_key?: string
        }
        Relationships: []
      }
      bob_messages: {
        Row: {
          content_json: Json | null
          content_text: string | null
          created_at: string
          id: string
          msg_type: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content_json?: Json | null
          content_text?: string | null
          created_at?: string
          id?: string
          msg_type: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content_json?: Json | null
          content_text?: string | null
          created_at?: string
          id?: string
          msg_type?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bob_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bob_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bob_prompts: {
        Row: {
          activity_type: string
          cefr_level: string | null
          description: string | null
          exam_part: string
          framework: string
          id: string
          label: string
          legacy_mode: string | null
          prompt_current: string
          prompt_default: string
          prompt_key: string
          updated_at: string
          updated_by: string | null
          variables: Json
        }
        Insert: {
          activity_type: string
          cefr_level?: string | null
          description?: string | null
          exam_part: string
          framework: string
          id?: string
          label: string
          legacy_mode?: string | null
          prompt_current: string
          prompt_default: string
          prompt_key: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Update: {
          activity_type?: string
          cefr_level?: string | null
          description?: string | null
          exam_part?: string
          framework?: string
          id?: string
          label?: string
          legacy_mode?: string | null
          prompt_current?: string
          prompt_default?: string
          prompt_key?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Relationships: []
      }
      bob_prompts_snapshot_v1: {
        Row: {
          activity_type: string | null
          cefr_level: string | null
          description: string | null
          id: string | null
          label: string | null
          mode: string | null
          prompt_current: string | null
          prompt_default: string | null
          prompt_key: string | null
          updated_at: string | null
          updated_by: string | null
          variables: Json | null
        }
        Insert: {
          activity_type?: string | null
          cefr_level?: string | null
          description?: string | null
          id?: string | null
          label?: string | null
          mode?: string | null
          prompt_current?: string | null
          prompt_default?: string | null
          prompt_key?: string | null
          updated_at?: string | null
          updated_by?: string | null
          variables?: Json | null
        }
        Update: {
          activity_type?: string | null
          cefr_level?: string | null
          description?: string | null
          id?: string | null
          label?: string | null
          mode?: string | null
          prompt_current?: string | null
          prompt_default?: string | null
          prompt_key?: string | null
          updated_at?: string | null
          updated_by?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      bob_sessions: {
        Row: {
          created_at: string
          id: string
          mode: string
          plan_json: Json | null
          title: string
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode: string
          plan_json?: Json | null
          title: string
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          plan_json?: Json | null
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      canva_account_links: {
        Row: {
          canva_ai_access_token_enc: string | null
          canva_ai_client_id_enc: string | null
          canva_ai_client_secret_enc: string | null
          canva_ai_is_active: boolean
          canva_ai_iv: string | null
          canva_ai_linked_at: string | null
          canva_ai_refresh_token_enc: string | null
          created_at: string
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          id: string
          is_active: boolean | null
          iv: string | null
          mcp_client_id: string | null
          mcp_client_secret: string | null
          mcp_encrypted_access_token: string | null
          mcp_encrypted_refresh_token: string | null
          mcp_iv: string | null
          mcp_linked: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canva_ai_access_token_enc?: string | null
          canva_ai_client_id_enc?: string | null
          canva_ai_client_secret_enc?: string | null
          canva_ai_is_active?: boolean
          canva_ai_iv?: string | null
          canva_ai_linked_at?: string | null
          canva_ai_refresh_token_enc?: string | null
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          is_active?: boolean | null
          iv?: string | null
          mcp_client_id?: string | null
          mcp_client_secret?: string | null
          mcp_encrypted_access_token?: string | null
          mcp_encrypted_refresh_token?: string | null
          mcp_iv?: string | null
          mcp_linked?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canva_ai_access_token_enc?: string | null
          canva_ai_client_id_enc?: string | null
          canva_ai_client_secret_enc?: string | null
          canva_ai_is_active?: boolean
          canva_ai_iv?: string | null
          canva_ai_linked_at?: string | null
          canva_ai_refresh_token_enc?: string | null
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          is_active?: boolean | null
          iv?: string | null
          mcp_client_id?: string | null
          mcp_client_secret?: string | null
          mcp_encrypted_access_token?: string | null
          mcp_encrypted_refresh_token?: string | null
          mcp_iv?: string | null
          mcp_linked?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      canva_ai_pending_auths: {
        Row: {
          client_id_enc: string
          client_secret_enc: string
          code_verifier_enc: string
          created_at: string
          expires_at: string
          redirect_uri: string
          state_hash: string
          user_id: string
        }
        Insert: {
          client_id_enc: string
          client_secret_enc: string
          code_verifier_enc: string
          created_at?: string
          expires_at?: string
          redirect_uri: string
          state_hash: string
          user_id: string
        }
        Update: {
          client_id_enc?: string
          client_secret_enc?: string
          code_verifier_enc?: string
          created_at?: string
          expires_at?: string
          redirect_uri?: string
          state_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      canva_design_templates: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          slide_count: number | null
          storage_path: string
          thumbnail_url: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slide_count?: number | null
          storage_path: string
          thumbnail_url?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slide_count?: number | null
          storage_path?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canva_design_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "canva_template_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      canva_template_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      canva_template_tag_assignments: {
        Row: {
          tag_id: string
          template_id: string
        }
        Insert: {
          tag_id: string
          template_id: string
        }
        Update: {
          tag_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canva_template_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "canva_template_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canva_template_tag_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "canva_design_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      canva_template_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          class_code: string
          created_at: string | null
          default_grade_code: string | null
          id: string
          is_archived: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          class_code: string
          created_at?: string | null
          default_grade_code?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          class_code?: string
          created_at?: string | null
          default_grade_code?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_history: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          is_structured: boolean | null
          message_index: number
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          is_structured?: boolean | null
          message_index: number
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_structured?: boolean | null
          message_index?: number
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_titles: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_titles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_uploads: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          organization_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          organization_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          organization_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      educational_legislatures: {
        Row: {
          autonomous_community: string | null
          country: string
          created_at: string
          description: string | null
          educational_stages: string[] | null
          id: string
          is_active: boolean | null
          key_points: string[] | null
          legislature_name: string
          priority: number | null
          prompt_context: string | null
          updated_at: string
        }
        Insert: {
          autonomous_community?: string | null
          country: string
          created_at?: string
          description?: string | null
          educational_stages?: string[] | null
          id?: string
          is_active?: boolean | null
          key_points?: string[] | null
          legislature_name: string
          priority?: number | null
          prompt_context?: string | null
          updated_at?: string
        }
        Update: {
          autonomous_community?: string | null
          country?: string
          created_at?: string
          description?: string | null
          educational_stages?: string[] | null
          id?: string
          is_active?: boolean | null
          key_points?: string[] | null
          legislature_name?: string
          priority?: number | null
          prompt_context?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      educational_stages: {
        Row: {
          created_at: string
          groups: string[] | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          groups?: string[] | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          groups?: string[] | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "educational_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          browser_info: Json | null
          column_number: number | null
          component_name: string | null
          created_at: string
          environment: string | null
          error_code: string | null
          error_message: string
          error_stack: string | null
          error_type: string | null
          file_path: string | null
          function_name: string | null
          id: string
          investigation_notes: string | null
          ip_address: string | null
          line_number: number | null
          method: string | null
          organization_id: string | null
          props_data: Json | null
          react_component_stack: string | null
          request_body: Json | null
          request_headers: Json | null
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          server_info: Json | null
          source_map_info: Json | null
          status: string | null
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser_info?: Json | null
          column_number?: number | null
          component_name?: string | null
          created_at?: string
          environment?: string | null
          error_code?: string | null
          error_message: string
          error_stack?: string | null
          error_type?: string | null
          file_path?: string | null
          function_name?: string | null
          id?: string
          investigation_notes?: string | null
          ip_address?: string | null
          line_number?: number | null
          method?: string | null
          organization_id?: string | null
          props_data?: Json | null
          react_component_stack?: string | null
          request_body?: Json | null
          request_headers?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          server_info?: Json | null
          source_map_info?: Json | null
          status?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser_info?: Json | null
          column_number?: number | null
          component_name?: string | null
          created_at?: string
          environment?: string | null
          error_code?: string | null
          error_message?: string
          error_stack?: string | null
          error_type?: string | null
          file_path?: string | null
          function_name?: string | null
          id?: string
          investigation_notes?: string | null
          ip_address?: string | null
          line_number?: number | null
          method?: string | null
          organization_id?: string | null
          props_data?: Json | null
          react_component_stack?: string | null
          request_body?: Json | null
          request_headers?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          server_info?: Json | null
          source_map_info?: Json | null
          status?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          answers: Json
          conclusions: string | null
          created_at: string
          id: string
          learning_insights: Json | null
          score: number | null
          session_id: string
        }
        Insert: {
          answers: Json
          conclusions?: string | null
          created_at?: string
          id?: string
          learning_insights?: Json | null
          score?: number | null
          session_id: string
        }
        Update: {
          answers?: Json
          conclusions?: string | null
          created_at?: string
          id?: string
          learning_insights?: Json | null
          score?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sessions: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          objectives: string | null
          organization_id: string
          original_content: Json
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          objectives?: string | null
          organization_id: string
          original_content: Json
          status?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          objectives?: string | null
          organization_id?: string
          original_content?: Json
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          flag_name: string
          id: string
          is_enabled: boolean | null
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          flag_name: string
          id?: string
          is_enabled?: boolean | null
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          flag_name?: string
          id?: string
          is_enabled?: boolean | null
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gemini_cache_references: {
        Row: {
          cache_key: string
          cache_name: string
          content_hash: string
          created_at: string | null
          expires_at: string
          id: string
          model: string
        }
        Insert: {
          cache_key: string
          cache_name: string
          content_hash: string
          created_at?: string | null
          expires_at: string
          id?: string
          model: string
        }
        Update: {
          cache_key?: string
          cache_name?: string
          content_hash?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          model?: string
        }
        Relationships: []
      }
      grade_level_mappings: {
        Row: {
          age_range: string
          grade_code: string
          grade_system: string
          label_en: string
          label_es: string
          sort_order: number
        }
        Insert: {
          age_range: string
          grade_code: string
          grade_system: string
          label_en: string
          label_es: string
          sort_order: number
        }
        Update: {
          age_range?: string
          grade_code?: string
          grade_system?: string
          label_en?: string
          label_es?: string
          sort_order?: number
        }
        Relationships: []
      }
      join_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip_hash: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_hash: string
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      mcp_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          conversation_id: string
          created_at: string
          error: string | null
          id: string
          idempotency_key: string | null
          itinerario_url: string | null
          itinerario_uuid: string | null
          job_type: string
          payload: Json
          result: Json | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          conversation_id: string
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          itinerario_url?: string | null
          itinerario_uuid?: string | null
          job_type?: string
          payload: Json
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          conversation_id?: string
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          itinerario_url?: string | null
          itinerario_uuid?: string | null
          job_type?: string
          payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      noobe_account_links: {
        Row: {
          access_token_expires_at: string | null
          created_at: string | null
          encrypted_access_token: string
          encrypted_refresh_token: string
          encryption_iv: string
          id: string
          is_active: boolean | null
          last_token_refresh_at: string | null
          linked_at: string | null
          noobe_matricula: string | null
          noobe_user_email: string | null
          noobe_user_name: string | null
          organization_id: string | null
          refresh_token_expires_at: string | null
          unlinked_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token_expires_at?: string | null
          created_at?: string | null
          encrypted_access_token: string
          encrypted_refresh_token: string
          encryption_iv: string
          id?: string
          is_active?: boolean | null
          last_token_refresh_at?: string | null
          linked_at?: string | null
          noobe_matricula?: string | null
          noobe_user_email?: string | null
          noobe_user_name?: string | null
          organization_id?: string | null
          refresh_token_expires_at?: string | null
          unlinked_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token_expires_at?: string | null
          created_at?: string | null
          encrypted_access_token?: string
          encrypted_refresh_token?: string
          encryption_iv?: string
          id?: string
          is_active?: boolean | null
          last_token_refresh_at?: string | null
          linked_at?: string | null
          noobe_matricula?: string | null
          noobe_user_email?: string | null
          noobe_user_name?: string | null
          organization_id?: string | null
          refresh_token_expires_at?: string | null
          unlinked_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      organization_frameworks: {
        Row: {
          created_at: string | null
          custom_settings: Json | null
          framework_id: string
          id: string
          is_primary: boolean | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_settings?: Json | null
          framework_id: string
          id?: string
          is_primary?: boolean | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_settings?: Json | null
          framework_id?: string
          id?: string
          is_primary?: boolean | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_frameworks_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "pedagogical_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_frameworks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          adaptations_enabled: boolean | null
          allow_data_retention: boolean
          allow_voice_storage: boolean
          autonomous_community: string | null
          background_color: string | null
          country: string | null
          created_at: string
          custom_prompt: string | null
          default_locale: string | null
          educational_stages: string[] | null
          educational_system: string[] | null
          grade_system: string | null
          header_style: Json | null
          id: string
          is_bob_enabled: boolean | null
          is_mia_enabled: boolean | null
          is_mia_student_enabled: boolean | null
          is_zoe_enabled: boolean | null
          logo_url: string | null
          name: string
          pedagogical_models: string[] | null
          primary_color: string | null
          progrentis_api_key: string | null
          progrentis_api_url: string | null
          progrentis_enabled: boolean | null
          project_document_content: string | null
          project_document_url: string | null
          region: string | null
          resources: string[] | null
          secondary_color: string | null
          short_code: string | null
          slug: string
          stages: string[] | null
          text_color: string | null
          theme_config: Json | null
          type: string | null
          updated_at: string
          zoe_default_age_range: string | null
        }
        Insert: {
          accent_color?: string | null
          adaptations_enabled?: boolean | null
          allow_data_retention?: boolean
          allow_voice_storage?: boolean
          autonomous_community?: string | null
          background_color?: string | null
          country?: string | null
          created_at?: string
          custom_prompt?: string | null
          default_locale?: string | null
          educational_stages?: string[] | null
          educational_system?: string[] | null
          grade_system?: string | null
          header_style?: Json | null
          id?: string
          is_bob_enabled?: boolean | null
          is_mia_enabled?: boolean | null
          is_mia_student_enabled?: boolean | null
          is_zoe_enabled?: boolean | null
          logo_url?: string | null
          name: string
          pedagogical_models?: string[] | null
          primary_color?: string | null
          progrentis_api_key?: string | null
          progrentis_api_url?: string | null
          progrentis_enabled?: boolean | null
          project_document_content?: string | null
          project_document_url?: string | null
          region?: string | null
          resources?: string[] | null
          secondary_color?: string | null
          short_code?: string | null
          slug: string
          stages?: string[] | null
          text_color?: string | null
          theme_config?: Json | null
          type?: string | null
          updated_at?: string
          zoe_default_age_range?: string | null
        }
        Update: {
          accent_color?: string | null
          adaptations_enabled?: boolean | null
          allow_data_retention?: boolean
          allow_voice_storage?: boolean
          autonomous_community?: string | null
          background_color?: string | null
          country?: string | null
          created_at?: string
          custom_prompt?: string | null
          default_locale?: string | null
          educational_stages?: string[] | null
          educational_system?: string[] | null
          grade_system?: string | null
          header_style?: Json | null
          id?: string
          is_bob_enabled?: boolean | null
          is_mia_enabled?: boolean | null
          is_mia_student_enabled?: boolean | null
          is_zoe_enabled?: boolean | null
          logo_url?: string | null
          name?: string
          pedagogical_models?: string[] | null
          primary_color?: string | null
          progrentis_api_key?: string | null
          progrentis_api_url?: string | null
          progrentis_enabled?: boolean | null
          project_document_content?: string | null
          project_document_url?: string | null
          region?: string | null
          resources?: string[] | null
          secondary_color?: string | null
          short_code?: string | null
          slug?: string
          stages?: string[] | null
          text_color?: string | null
          theme_config?: Json | null
          type?: string | null
          updated_at?: string
          zoe_default_age_range?: string | null
        }
        Relationships: []
      }
      pdf_itinerary_extractions: {
        Row: {
          conversation_id: string
          created_at: string
          extracted: Json
          id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          extracted: Json
          id?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          extracted?: Json
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      pedagogical_frameworks: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          educational_stages: string[] | null
          educational_systems: string[] | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          structure: Json
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          educational_stages?: string[] | null
          educational_systems?: string[] | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          structure: Json
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          educational_stages?: string[] | null
          educational_systems?: string[] | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          structure?: Json
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedagogical_frameworks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pedagogical_resources: {
        Row: {
          category: string
          content: string
          created_at: string | null
          created_by: string | null
          educational_stages: string[] | null
          examples: Json | null
          framework_id: string | null
          id: string
          is_active: boolean | null
          name: string
          subjects: string[] | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          created_by?: string | null
          educational_stages?: string[] | null
          examples?: Json | null
          framework_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subjects?: string[] | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          educational_stages?: string[] | null
          examples?: Json | null
          framework_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subjects?: string[] | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedagogical_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedagogical_resources_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "pedagogical_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_config: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      professor_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          template_content: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          template_content: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          template_content?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cefr_active_level: string | null
          cefr_level_locked: boolean
          class_id: string | null
          created_at: string
          custom_prompt: string | null
          data_policy_accepted_at: string | null
          educational_group: string | null
          educational_stage: string | null
          educational_stage_id: string | null
          educational_stages: string[] | null
          email: string
          experience_level: string | null
          full_name: string | null
          grade_code: string | null
          id: string
          is_active: boolean | null
          organization_id: string | null
          preferred_locale: string | null
          progrentis_email: string | null
          role: Database["public"]["Enums"]["user_role"]
          role_id: string | null
          student_preferences_id: string | null
          subject: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          cefr_active_level?: string | null
          cefr_level_locked?: boolean
          class_id?: string | null
          created_at?: string
          custom_prompt?: string | null
          data_policy_accepted_at?: string | null
          educational_group?: string | null
          educational_stage?: string | null
          educational_stage_id?: string | null
          educational_stages?: string[] | null
          email: string
          experience_level?: string | null
          full_name?: string | null
          grade_code?: string | null
          id: string
          is_active?: boolean | null
          organization_id?: string | null
          preferred_locale?: string | null
          progrentis_email?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          role_id?: string | null
          student_preferences_id?: string | null
          subject?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          cefr_active_level?: string | null
          cefr_level_locked?: boolean
          class_id?: string | null
          created_at?: string
          custom_prompt?: string | null
          data_policy_accepted_at?: string | null
          educational_group?: string | null
          educational_stage?: string | null
          educational_stage_id?: string | null
          educational_stages?: string[] | null
          email?: string
          experience_level?: string | null
          full_name?: string | null
          grade_code?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          preferred_locale?: string | null
          progrentis_email?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          role_id?: string | null
          student_preferences_id?: string | null
          subject?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_educational_stage_id_fkey"
            columns: ["educational_stage_id"]
            isOneToOne: false
            referencedRelation: "educational_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_student_preferences_id_fkey"
            columns: ["student_preferences_id"]
            isOneToOne: false
            referencedRelation: "student_preferences"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_layers: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["prompt_layer_type"]
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["prompt_layer_type"]
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["prompt_layer_type"]
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      quick_action_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string
          id: string
          is_active: boolean | null
          name: string
          order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon: string
          id?: string
          is_active?: boolean | null
          name: string
          order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quick_actions: {
        Row: {
          category_id: string
          created_at: string | null
          description: string | null
          generation_type: string
          icon: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_premium: boolean | null
          order: number | null
          prompt_template: string
          settings: Json | null
          subtitle: string | null
          title: string
          updated_at: string | null
          variables: string[] | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          description?: string | null
          generation_type: string
          icon: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_premium?: boolean | null
          order?: number | null
          prompt_template: string
          settings?: Json | null
          subtitle?: string | null
          title: string
          updated_at?: string | null
          variables?: string[] | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          description?: string | null
          generation_type?: string
          icon?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_premium?: boolean | null
          order?: number | null
          prompt_template?: string
          settings?: Json | null
          subtitle?: string | null
          title?: string
          updated_at?: string | null
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_actions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "quick_action_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          permissions: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          permissions?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          permissions?: Json | null
        }
        Relationships: []
      }
      student_english_frameworks: {
        Row: {
          assigned_at: string
          framework_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          framework_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          framework_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_english_frameworks_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "pedagogical_frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      student_preferences: {
        Row: {
          created_at: string | null
          dyslexia_font: boolean | null
          grade_override: string | null
          high_contrast: boolean | null
          id: string
          profile_id: string
          reduce_motion: boolean | null
          tts_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dyslexia_font?: boolean | null
          grade_override?: string | null
          high_contrast?: boolean | null
          id?: string
          profile_id: string
          reduce_motion?: boolean | null
          tts_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dyslexia_font?: boolean | null
          grade_override?: string | null
          high_contrast?: boolean | null
          id?: string
          profile_id?: string
          reduce_motion?: boolean | null
          tts_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_prompts: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          layer: string
          metadata: Json | null
          name: string | null
          organization_id: string | null
          parent_prompt_id: string | null
          user_id: string | null
          variables: Json | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          layer: string
          metadata?: Json | null
          name?: string | null
          organization_id?: string | null
          parent_prompt_id?: string | null
          user_id?: string | null
          variables?: Json | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          layer?: string
          metadata?: Json | null
          name?: string | null
          organization_id?: string | null
          parent_prompt_id?: string | null
          user_id?: string | null
          variables?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "system_prompts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_prompts_parent_prompt_id_fkey"
            columns: ["parent_prompt_id"]
            isOneToOne: false
            referencedRelation: "system_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          created_at: string | null
          feedback_text: string
          feedback_type: string | null
          id: string
          metadata: Json | null
          page_url: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          feedback_text: string
          feedback_type?: string | null
          id?: string
          metadata?: Json | null
          page_url?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          feedback_text?: string
          feedback_type?: string | null
          id?: string
          metadata?: Json | null
          page_url?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          class_id: string | null
          created_at: string | null
          educational_stage: string | null
          educational_stages: string[] | null
          email: string
          expires_at: string
          grade_code: string | null
          id: string
          invited_by: string | null
          invited_by_user_id: string | null
          organization_id: string | null
          role_id: string | null
          status: string | null
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          class_id?: string | null
          created_at?: string | null
          educational_stage?: string | null
          educational_stages?: string[] | null
          email: string
          expires_at: string
          grade_code?: string | null
          id?: string
          invited_by?: string | null
          invited_by_user_id?: string | null
          organization_id?: string | null
          role_id?: string | null
          status?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          class_id?: string | null
          created_at?: string | null
          educational_stage?: string | null
          educational_stages?: string[] | null
          email?: string
          expires_at?: string
          grade_code?: string | null
          id?: string
          invited_by?: string | null
          invited_by_user_id?: string | null
          organization_id?: string | null
          role_id?: string | null
          status?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_quick_action_preferences: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          is_visible: boolean | null
          quick_action_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_visible?: boolean | null
          quick_action_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_visible?: boolean | null
          quick_action_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_quick_action_preferences_quick_action_id_fkey"
            columns: ["quick_action_id"]
            isOneToOne: false
            referencedRelation: "quick_actions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_analyze_organization_impact: {
        Args: { org_id: string }
        Returns: Json
      }
      admin_delete_organization_complete: {
        Args: { org_id: string }
        Returns: Json
      }
      admin_delete_organization_invitations: {
        Args: { org_id: string }
        Returns: number
      }
      admin_delete_organization_itineraries: {
        Args: { org_id: string }
        Returns: number
      }
      admin_get_global_activity_stats: {
        Args: { days_limit?: number }
        Returns: {
          active_organizations: number
          content_generated: number
          date: string
          new_users: number
        }[]
      }
      admin_get_global_summary_stats: { Args: never; Returns: Json }
      claim_next_mcp_job: {
        Args: { p_job_types?: string[] }
        Returns: {
          attempts: number
          completed_at: string | null
          conversation_id: string
          created_at: string
          error: string | null
          id: string
          idempotency_key: string | null
          itinerario_url: string | null
          itinerario_uuid: string | null
          job_type: string
          payload: Json
          result: Json | null
          started_at: string | null
          status: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "mcp_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      consume_canva_ai_pending_auth: {
        Args: { p_state_hash: string }
        Returns: {
          client_id_enc: string
          client_secret_enc: string
          code_verifier_enc: string
          created_at: string
          expires_at: string
          redirect_uri: string
          state_hash: string
          user_id: string
        }[]
      }
      generate_unique_short_code: {
        Args: { org_name: string }
        Returns: string
      }
      get_my_organization: { Args: never; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      prompt_layer_type:
        | "global"
        | "institution"
        | "school"
        | "stage"
        | "age_tier"
      user_role: "super_admin" | "school_admin" | "teacher" | "student"
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
      prompt_layer_type: [
        "global",
        "institution",
        "school",
        "stage",
        "age_tier",
      ],
      user_role: ["super_admin", "school_admin", "teacher", "student"],
    },
  },
} as const
