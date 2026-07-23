export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      abuse_logs: {
        Row: {
          criado_em: string;
          detalhes: Json;
          id: string;
          ip: string | null;
          motivo: string;
          rota: string | null;
          user_agent: string | null;
        };
        Insert: {
          criado_em?: string;
          detalhes?: Json;
          id?: string;
          ip?: string | null;
          motivo: string;
          rota?: string | null;
          user_agent?: string | null;
        };
        Update: {
          criado_em?: string;
          detalhes?: Json;
          id?: string;
          ip?: string | null;
          motivo?: string;
          rota?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          acao: string;
          admin_id: string;
          cliente_cpf: string | null;
          criado_em: string;
          detalhes: Json;
          id: string;
          ip: string | null;
          user_agent: string | null;
        };
        Insert: {
          acao: string;
          admin_id: string;
          cliente_cpf?: string | null;
          criado_em?: string;
          detalhes?: Json;
          id?: string;
          ip?: string | null;
          user_agent?: string | null;
        };
        Update: {
          acao?: string;
          admin_id?: string;
          cliente_cpf?: string | null;
          criado_em?: string;
          detalhes?: Json;
          id?: string;
          ip?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      admins: {
        Row: {
          criado_em: string;
          user_id: string;
        };
        Insert: {
          criado_em?: string;
          user_id: string;
        };
        Update: {
          criado_em?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tattoo_artists: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          id: string;
          nome: string;
          slug: string;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          nome: string;
          slug: string;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          nome?: string;
          slug?: string;
        };
        Relationships: [];
      };
      app_config: {
        Row: {
          atualizado_em: string;
          key: string;
          value: string | null;
        };
        Insert: {
          atualizado_em?: string;
          key: string;
          value?: string | null;
        };
        Update: {
          atualizado_em?: string;
          key?: string;
          value?: string | null;
        };
        Relationships: [];
      };
      backup_audit_log: {
        Row: {
          action: string;
          actor: string | null;
          criado_em: string;
          details: Json;
          id: string;
          ip: string | null;
          target_id: string | null;
          target_kind: string | null;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          actor?: string | null;
          criado_em?: string;
          details?: Json;
          id?: string;
          ip?: string | null;
          target_id?: string | null;
          target_kind?: string | null;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          criado_em?: string;
          details?: Json;
          id?: string;
          ip?: string | null;
          target_id?: string | null;
          target_kind?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      backup_destinations: {
        Row: {
          atualizado_em: string;
          config_masked: Json;
          criado_em: string;
          criado_por: string | null;
          id: string;
          kind: string;
          label: string;
          last_error: string | null;
          last_tested_at: string | null;
          secret_refs: Json;
          status: string;
        };
        Insert: {
          atualizado_em?: string;
          config_masked?: Json;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          kind: string;
          label: string;
          last_error?: string | null;
          last_tested_at?: string | null;
          secret_refs?: Json;
          status?: string;
        };
        Update: {
          atualizado_em?: string;
          config_masked?: Json;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          kind?: string;
          label?: string;
          last_error?: string | null;
          last_tested_at?: string | null;
          secret_refs?: Json;
          status?: string;
        };
        Relationships: [];
      };
      backup_jobs: {
        Row: {
          arquivos_incluidos: number | null;
          checksum_sha256: string | null;
          completed_at: string | null;
          content: Json;
          criado_por: string | null;
          destination_id: string | null;
          destination_kind: string | null;
          duration_ms: number | null;
          error_message: string | null;
          id: string;
          manifest: Json | null;
          progress_stages: Json;
          registros_incluidos: number | null;
          size_bytes: number | null;
          stage: string | null;
          started_at: string;
          status: string;
          storage_path: string | null;
          system_version: string | null;
          type: string;
          warnings: Json;
        };
        Insert: {
          arquivos_incluidos?: number | null;
          checksum_sha256?: string | null;
          completed_at?: string | null;
          content?: Json;
          criado_por?: string | null;
          destination_id?: string | null;
          destination_kind?: string | null;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          manifest?: Json | null;
          progress_stages?: Json;
          registros_incluidos?: number | null;
          size_bytes?: number | null;
          stage?: string | null;
          started_at?: string;
          status?: string;
          storage_path?: string | null;
          system_version?: string | null;
          type: string;
          warnings?: Json;
        };
        Update: {
          arquivos_incluidos?: number | null;
          checksum_sha256?: string | null;
          completed_at?: string | null;
          content?: Json;
          criado_por?: string | null;
          destination_id?: string | null;
          destination_kind?: string | null;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          manifest?: Json | null;
          progress_stages?: Json;
          registros_incluidos?: number | null;
          size_bytes?: number | null;
          stage?: string | null;
          started_at?: string;
          status?: string;
          storage_path?: string | null;
          system_version?: string | null;
          type?: string;
          warnings?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "backup_jobs_destination_id_fkey";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "backup_destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      backup_logs: {
        Row: {
          concluido_em: string;
          csv_tab: string | null;
          detalhes: Json;
          duracao_ms: number | null;
          id: string;
          iniciado_em: string;
          mensagem: string | null;
          spreadsheet_id: string | null;
          spreadsheet_url: string | null;
          status: string;
          total_clientes: number | null;
        };
        Insert: {
          concluido_em?: string;
          csv_tab?: string | null;
          detalhes?: Json;
          duracao_ms?: number | null;
          id?: string;
          iniciado_em?: string;
          mensagem?: string | null;
          spreadsheet_id?: string | null;
          spreadsheet_url?: string | null;
          status: string;
          total_clientes?: number | null;
        };
        Update: {
          concluido_em?: string;
          csv_tab?: string | null;
          detalhes?: Json;
          duracao_ms?: number | null;
          id?: string;
          iniciado_em?: string;
          mensagem?: string | null;
          spreadsheet_id?: string | null;
          spreadsheet_url?: string | null;
          status?: string;
          total_clientes?: number | null;
        };
        Relationships: [];
      };
      backup_settings: {
        Row: {
          atualizado_em: string;
          auto_enabled: boolean;
          content: Json;
          criado_em: string;
          encryption_enabled: boolean;
          encryption_version: string | null;
          frequency: string;
          hour: number;
          id: string;
          retention_daily: number;
          retention_monthly: number;
          retention_weekly: number;
          retention_yearly: number;
          singleton: boolean;
          timezone: string;
        };
        Insert: {
          atualizado_em?: string;
          auto_enabled?: boolean;
          content?: Json;
          criado_em?: string;
          encryption_enabled?: boolean;
          encryption_version?: string | null;
          frequency?: string;
          hour?: number;
          id?: string;
          retention_daily?: number;
          retention_monthly?: number;
          retention_weekly?: number;
          retention_yearly?: number;
          singleton?: boolean;
          timezone?: string;
        };
        Update: {
          atualizado_em?: string;
          auto_enabled?: boolean;
          content?: Json;
          criado_em?: string;
          encryption_enabled?: boolean;
          encryption_version?: string | null;
          frequency?: string;
          hour?: number;
          id?: string;
          retention_daily?: number;
          retention_monthly?: number;
          retention_weekly?: number;
          retention_yearly?: number;
          singleton?: boolean;
          timezone?: string;
        };
        Relationships: [];
      };
      check_in_events: {
        Row: {
          actor_id: string | null;
          check_in_id: string;
          criado_em: string;
          detalhes: Json;
          from_status: Database["public"]["Enums"]["check_in_status"] | null;
          id: string;
          kind: Database["public"]["Enums"]["check_in_event_kind"];
          motivo: string | null;
          to_status: Database["public"]["Enums"]["check_in_status"] | null;
        };
        Insert: {
          actor_id?: string | null;
          check_in_id: string;
          criado_em?: string;
          detalhes?: Json;
          from_status?: Database["public"]["Enums"]["check_in_status"] | null;
          id?: string;
          kind: Database["public"]["Enums"]["check_in_event_kind"];
          motivo?: string | null;
          to_status?: Database["public"]["Enums"]["check_in_status"] | null;
        };
        Update: {
          actor_id?: string | null;
          check_in_id?: string;
          criado_em?: string;
          detalhes?: Json;
          from_status?: Database["public"]["Enums"]["check_in_status"] | null;
          id?: string;
          kind?: Database["public"]["Enums"]["check_in_event_kind"];
          motivo?: string | null;
          to_status?: Database["public"]["Enums"]["check_in_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "check_in_events_check_in_id_fkey";
            columns: ["check_in_id"];
            isOneToOne: false;
            referencedRelation: "check_ins";
            referencedColumns: ["id"];
          },
        ];
      };
      check_ins: {
        Row: {
          arrival_at: string;
          atualizado_em: string;
          called_at: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cliente_nome: string;
          completed_at: string | null;
          cpf: string;
          created_by: string | null;
          criado_em: string;
          has_assinatura: boolean;
          has_ficha: boolean;
          id: string;
          no_show_at: string | null;
          observacoes: string | null;
          queue_day: string;
          queue_position: number;
          risk_flag: boolean;
          risk_reasons: string[];
          session_index: number | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["check_in_status"];
          tatuador: string | null;
          updated_by: string | null;
        };
        Insert: {
          arrival_at?: string;
          atualizado_em?: string;
          called_at?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cliente_nome: string;
          completed_at?: string | null;
          cpf: string;
          created_by?: string | null;
          criado_em?: string;
          has_assinatura?: boolean;
          has_ficha?: boolean;
          id?: string;
          no_show_at?: string | null;
          observacoes?: string | null;
          queue_day?: string;
          queue_position?: number;
          risk_flag?: boolean;
          risk_reasons?: string[];
          session_index?: number | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["check_in_status"];
          tatuador?: string | null;
          updated_by?: string | null;
        };
        Update: {
          arrival_at?: string;
          atualizado_em?: string;
          called_at?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cliente_nome?: string;
          completed_at?: string | null;
          cpf?: string;
          created_by?: string | null;
          criado_em?: string;
          has_assinatura?: boolean;
          has_ficha?: boolean;
          id?: string;
          no_show_at?: string | null;
          observacoes?: string | null;
          queue_day?: string;
          queue_position?: number;
          risk_flag?: boolean;
          risk_reasons?: string[];
          session_index?: number | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["check_in_status"];
          tatuador?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      clientes: {
        Row: {
          anamnese: Json;
          anamnese_enc: string | null;
          assinatura: string | null;
          atualizado_em: string;
          cpf: string;
          criado_em: string;
          dados_cadastrais: Json;
          email: string | null;
          id: string;
          nome_completo: string;
          sessoes: Json;
          status: string;
          tatuador: string | null;
          telefone: string | null;
        };
        Insert: {
          anamnese?: Json;
          anamnese_enc?: string | null;
          assinatura?: string | null;
          atualizado_em?: string;
          cpf: string;
          criado_em?: string;
          dados_cadastrais?: Json;
          email?: string | null;
          id?: string;
          nome_completo: string;
          sessoes?: Json;
          status?: string;
          tatuador?: string | null;
          telefone?: string | null;
        };
        Update: {
          anamnese?: Json;
          anamnese_enc?: string | null;
          assinatura?: string | null;
          atualizado_em?: string;
          cpf?: string;
          criado_em?: string;
          dados_cadastrais?: Json;
          email?: string | null;
          id?: string;
          nome_completo?: string;
          sessoes?: Json;
          status?: string;
          tatuador?: string | null;
          telefone?: string | null;
        };
        Relationships: [];
      };
      consent_records: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          artist_snapshot: Json;
          client_snapshot: Json;
          config_snapshot: Json;
          consent_scope: string | null;
          cpf: string;
          criado_em: string;
          created_at: string;
          device: Json;
          document_type: string | null;
          finalidade: string | null;
          id: string;
          ip: string | null;
          metadata: Json;
          rendered_html: string | null;
          rendered_text: string | null;
          revogado_em: string | null;
          signature_snapshot: Json;
          source: string | null;
          status: string | null;
          template_hash: string | null;
          template_version: string | null;
          texto_hash: string;
          titular_ref: string | null;
          tipo: string;
          user_agent: string | null;
          versao: string;
          contexto: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          artist_snapshot?: Json;
          client_snapshot?: Json;
          config_snapshot?: Json;
          consent_scope?: string | null;
          cpf: string;
          criado_em?: string;
          created_at?: string;
          device?: Json;
          document_type?: string | null;
          finalidade?: string | null;
          id?: string;
          ip?: string | null;
          metadata?: Json;
          rendered_html?: string | null;
          rendered_text?: string | null;
          revogado_em?: string | null;
          signature_snapshot?: Json;
          source?: string | null;
          status?: string | null;
          template_hash?: string | null;
          template_version?: string | null;
          texto_hash: string;
          titular_ref?: string | null;
          tipo: string;
          user_agent?: string | null;
          versao?: string;
          contexto?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          artist_snapshot?: Json;
          client_snapshot?: Json;
          config_snapshot?: Json;
          consent_scope?: string | null;
          cpf?: string;
          criado_em?: string;
          created_at?: string;
          device?: Json;
          document_type?: string | null;
          finalidade?: string | null;
          id?: string;
          ip?: string | null;
          metadata?: Json;
          rendered_html?: string | null;
          rendered_text?: string | null;
          revogado_em?: string | null;
          signature_snapshot?: Json;
          source?: string | null;
          status?: string | null;
          template_hash?: string | null;
          template_version?: string | null;
          texto_hash?: string;
          titular_ref?: string | null;
          tipo?: string;
          user_agent?: string | null;
          versao?: string;
          contexto?: string | null;
        };
        Relationships: [];
      };
      data_subject_requests: {
        Row: {
          cpf: string;
          criado_em: string;
          email: string | null;
          id: string;
          ip: string | null;
          motivo: string | null;
          resolvido_em: string | null;
          resolvido_por: string | null;
          resposta: string | null;
          status: string;
          tipo: string;
          user_agent: string | null;
        };
        Insert: {
          cpf: string;
          criado_em?: string;
          email?: string | null;
          id?: string;
          ip?: string | null;
          motivo?: string | null;
          resolvido_em?: string | null;
          resolvido_por?: string | null;
          resposta?: string | null;
          status?: string;
          tipo: string;
          user_agent?: string | null;
        };
        Update: {
          cpf?: string;
          criado_em?: string;
          email?: string | null;
          id?: string;
          ip?: string | null;
          motivo?: string | null;
          resolvido_em?: string | null;
          resolvido_por?: string | null;
          resposta?: string | null;
          status?: string;
          tipo?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      login_attempts: {
        Row: {
          criado_em: string;
          email: string | null;
          id: string;
          ip: string | null;
          success: boolean;
          user_agent: string | null;
        };
        Insert: {
          criado_em?: string;
          email?: string | null;
          id?: string;
          ip?: string | null;
          success?: boolean;
          user_agent?: string | null;
        };
        Update: {
          criado_em?: string;
          email?: string | null;
          id?: string;
          ip?: string | null;
          success?: boolean;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      rate_limit_buckets: {
        Row: {
          bucket_key: string;
          count: number;
          window_start: string;
        };
        Insert: {
          bucket_key: string;
          count?: number;
          window_start: string;
        };
        Update: {
          bucket_key?: string;
          count?: number;
          window_start?: string;
        };
        Relationships: [];
      };
      restore_jobs: {
        Row: {
          backup_job_id: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          error_message: string | null;
          id: string;
          impact: Json | null;
          preview: Json | null;
          requested_by: string | null;
          scope: string;
          snapshot_job_id: string | null;
          started_at: string;
          status: string;
        };
        Insert: {
          backup_job_id?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          error_message?: string | null;
          id?: string;
          impact?: Json | null;
          preview?: Json | null;
          requested_by?: string | null;
          scope?: string;
          snapshot_job_id?: string | null;
          started_at?: string;
          status?: string;
        };
        Update: {
          backup_job_id?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          error_message?: string | null;
          id?: string;
          impact?: Json | null;
          preview?: Json | null;
          requested_by?: string | null;
          scope?: string;
          snapshot_job_id?: string | null;
          started_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restore_jobs_backup_job_id_fkey";
            columns: ["backup_job_id"];
            isOneToOne: false;
            referencedRelation: "backup_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restore_jobs_snapshot_job_id_fkey";
            columns: ["snapshot_job_id"];
            isOneToOne: false;
            referencedRelation: "backup_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      risk_review_events: {
        Row: {
          actor_id: string | null;
          alert_id: string;
          created_at: string;
          detalhes: Json;
          from_decision: string | null;
          from_status: string | null;
          id: string;
          kind: string;
          motivo: string | null;
          to_decision: string | null;
          to_status: string | null;
        };
        Insert: {
          actor_id?: string | null;
          alert_id: string;
          created_at?: string;
          detalhes?: Json;
          from_decision?: string | null;
          from_status?: string | null;
          id?: string;
          kind: string;
          motivo?: string | null;
          to_decision?: string | null;
          to_status?: string | null;
        };
        Update: {
          actor_id?: string | null;
          alert_id?: string;
          created_at?: string;
          detalhes?: Json;
          from_decision?: string | null;
          from_status?: string | null;
          id?: string;
          kind?: string;
          motivo?: string | null;
          to_decision?: string | null;
          to_status?: string | null;
        };
        Relationships: [];
      };
      risk_reviews: {
        Row: {
          alert_id: string;
          cpf: string;
          created_at: string;
          decision: string | null;
          form_id: string;
          form_version: number;
          level: string;
          observacao: string | null;
          previous_decision: string | null;
          previous_observacao: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          alert_id: string;
          cpf: string;
          created_at?: string;
          decision?: string | null;
          form_id: string;
          form_version?: number;
          level: string;
          observacao?: string | null;
          previous_decision?: string | null;
          previous_observacao?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          alert_id?: string;
          cpf?: string;
          created_at?: string;
          decision?: string | null;
          form_id?: string;
          form_version?: number;
          level?: string;
          observacao?: string | null;
          previous_decision?: string | null;
          previous_observacao?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      backup_overview: {
        Row: {
          auto_enabled: boolean | null;
          destinos_conectados: number | null;
          destinos_total: number | null;
          encryption_enabled: boolean | null;
          ultimo_backup: Json | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      anonymize_cliente: { Args: { _cpf: string }; Returns: undefined };
      check_login_lockout: {
        Args: { _email: string; _ip: string };
        Returns: Json;
      };
      checkin_add_note: {
        Args: { _id: string; _texto: string };
        Returns: undefined;
      };
      checkin_append_sessao: {
        Args: {
          _anamnese?: Json;
          _cpf: string;
          _sessao: Json;
          _tatuador?: string;
        };
        Returns: undefined;
      };
      checkin_call: { Args: { _id: string }; Returns: undefined };
      checkin_cancel: {
        Args: { _id: string; _motivo: string };
        Returns: undefined;
      };
      checkin_complete: {
        Args: { _id: string; _observacao?: string };
        Returns: undefined;
      };
      checkin_create: {
        Args: {
          _cliente_nome: string;
          _cpf: string;
          _has_assinatura?: boolean;
          _has_ficha?: boolean;
          _observacoes?: string;
          _risk_flag?: boolean;
          _risk_reasons?: string[];
          _tatuador: string;
        };
        Returns: string;
      };
      checkin_get_cliente: {
        Args: { _cpf: string };
        Returns: {
          cpf: string;
          nome_completo: string;
          tatuador: string;
        }[];
      };
      checkin_no_show: { Args: { _id: string }; Returns: undefined };
      checkin_reorder: {
        Args: { _id: string; _new_position: number };
        Returns: undefined;
      };
      checkin_start: { Args: { _id: string }; Returns: undefined };
      delete_cliente_lgpd: { Args: { _cpf: string }; Returns: undefined };
      get_public_document_context: { Args: never; Returns: Json };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      latest_backup_status: {
        Args: never;
        Returns: {
          concluido_em: string;
          duracao_ms: number;
          iniciado_em: string;
          mensagem: string;
          spreadsheet_url: string;
          status: string;
          total_clientes: number;
        }[];
      };
      log_admin_action: {
        Args: {
          _acao: string;
          _cliente_cpf?: string;
          _detalhes?: Json;
          _ip?: string;
          _user_agent?: string;
        };
        Returns: string;
      };
      rate_limit_check: {
        Args: { _key: string; _max: number; _window_seconds: number };
        Returns: boolean;
      };
      record_abuse: {
        Args: {
          _detalhes?: Json;
          _ip: string;
          _motivo: string;
          _rota: string;
          _user_agent?: string;
        };
        Returns: string;
      };
      record_login_attempt: {
        Args: {
          _email: string;
          _ip: string;
          _success: boolean;
          _user_agent?: string;
        };
        Returns: undefined;
      };
      registrar_consentimento: {
        Args: {
          _accepted_at?: string;
          _accepted_by?: string;
          _artist_snapshot?: Json;
          _client_snapshot?: Json;
          _config_snapshot?: Json;
          _consent_scope?: string;
          _cpf: string;
          _device?: Json;
          _document_type?: string;
          _finalidade?: string;
          _ip?: string;
          _metadata?: Json;
          _rendered_html?: string;
          _rendered_text?: string;
          _signature_snapshot?: Json;
          _source?: string;
          _status?: string;
          _template_hash?: string;
          _template_version?: string;
          _texto_hash: string;
          _titular_ref?: string;
          _tipo: string;
          _user_agent?: string;
          _versao?: string;
          _contexto?: string;
        };
        Returns: string;
      };
      risk_review_add_note: {
        Args: { _alert_id: string; _texto: string };
        Returns: undefined;
      };
      risk_review_archive: {
        Args: { _alert_id: string; _motivo: string };
        Returns: undefined;
      };
      risk_review_set: {
        Args: {
          _alert_id: string;
          _cpf: string;
          _decision: string;
          _form_id: string;
          _form_version: number;
          _level: string;
          _motivo_alt?: string;
          _new_status: string;
          _observacao: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "gerente" | "recepcao";
      check_in_event_kind:
        | "created"
        | "called"
        | "started"
        | "completed"
        | "cancelled"
        | "no_show"
        | "reordered"
        | "note_added"
        | "reopened";
      check_in_status: "waiting" | "called" | "in_service" | "completed" | "cancelled" | "no_show";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    Enums: {
      app_role: ["admin", "gerente", "recepcao"],
      check_in_event_kind: [
        "created",
        "called",
        "started",
        "completed",
        "cancelled",
        "no_show",
        "reordered",
        "note_added",
        "reopened",
      ],
      check_in_status: ["waiting", "called", "in_service", "completed", "cancelled", "no_show"],
    },
  },
} as const;
