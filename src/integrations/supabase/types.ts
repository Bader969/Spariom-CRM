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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          meta: Json
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          meta?: Json
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          meta?: Json
          target_user_id?: string | null
        }
        Relationships: []
      }
      allowed_emails: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      application_events: {
        Row: {
          application_id: string
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          meta: Json
          user_agent: string | null
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          meta?: Json
          user_agent?: string | null
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          meta?: Json
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_recipients: {
        Row: {
          antragsform: string | null
          bcc: string | null
          cc: string | null
          created_at: string
          id: string
          krankenkasse: string
          recipient_email: string
          updated_at: string
        }
        Insert: {
          antragsform?: string | null
          bcc?: string | null
          cc?: string | null
          created_at?: string
          id?: string
          krankenkasse: string
          recipient_email: string
          updated_at?: string
        }
        Update: {
          antragsform?: string | null
          bcc?: string | null
          cc?: string | null
          created_at?: string
          id?: string
          krankenkasse?: string
          recipient_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          antragsform: string | null
          applicant_geburtsdatum: string | null
          applicant_name: string | null
          applicant_vorname: string | null
          created_at: string
          crm_synced_at: string | null
          crm_target: string | null
          crm_target_synced_at: string | null
          exported_at: string | null
          id: string
          intake_meta: Json
          krankenkasse: string
          last_opened_at: string | null
          parent_application_id: string | null
          payload_encrypted: string
          payload_hash: string
          payload_iv: string
          pdf_count: number
          person_index: number | null
          person_role: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
          vertriebspartner: string | null
        }
        Insert: {
          antragsform?: string | null
          applicant_geburtsdatum?: string | null
          applicant_name?: string | null
          applicant_vorname?: string | null
          created_at?: string
          crm_synced_at?: string | null
          crm_target?: string | null
          crm_target_synced_at?: string | null
          exported_at?: string | null
          id?: string
          intake_meta?: Json
          krankenkasse: string
          last_opened_at?: string | null
          parent_application_id?: string | null
          payload_encrypted: string
          payload_hash: string
          payload_iv: string
          pdf_count?: number
          person_index?: number | null
          person_role?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
          vertriebspartner?: string | null
        }
        Update: {
          antragsform?: string | null
          applicant_geburtsdatum?: string | null
          applicant_name?: string | null
          applicant_vorname?: string | null
          created_at?: string
          crm_synced_at?: string | null
          crm_target?: string | null
          crm_target_synced_at?: string | null
          exported_at?: string | null
          id?: string
          intake_meta?: Json
          krankenkasse?: string
          last_opened_at?: string | null
          parent_application_id?: string | null
          payload_encrypted?: string
          payload_hash?: string
          payload_iv?: string
          pdf_count?: number
          person_index?: number | null
          person_role?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          vertriebspartner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_parent_application_id_fkey"
            columns: ["parent_application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_email_allowlist: {
        Row: {
          added_at: string
          added_by: string | null
          email: string
          note: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          email: string
          note?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      auth_login_attempts: {
        Row: {
          attempted_at: string
          email: string | null
          id: number
          ip: string
          success: boolean
        }
        Insert: {
          attempted_at?: string
          email?: string | null
          id?: number
          ip: string
          success?: boolean
        }
        Update: {
          attempted_at?: string
          email?: string | null
          id?: number
          ip?: string
          success?: boolean
        }
        Relationships: []
      }
      clarifications: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["clarification_category"]
          contract_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["clarification_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["clarification_category"]
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["clarification_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["clarification_category"]
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["clarification_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clarifications_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clarifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          contract_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          uploaded_by: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          uploaded_by?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_family_members: {
        Row: {
          abweichende_anschrift: string | null
          birthdate: string | null
          bisherig_art: Database["public"]["Enums"]["kv_bisherig_art"] | null
          bisherig_ende: string | null
          bisherig_kasse: string | null
          contract_id: string
          created_at: string
          first_name: string
          geburtsland: string | null
          geburtsname: string | null
          geburtsort: string | null
          geschlecht: Database["public"]["Enums"]["kv_geschlecht"] | null
          id: string
          last_name: string
          relation: Database["public"]["Enums"]["family_relation"]
          staatsangehoerigkeit: string | null
          updated_at: string
          versicherungsnummer: string | null
          verwandtschaft:
            | Database["public"]["Enums"]["kv_verwandtschaft"]
            | null
        }
        Insert: {
          abweichende_anschrift?: string | null
          birthdate?: string | null
          bisherig_art?: Database["public"]["Enums"]["kv_bisherig_art"] | null
          bisherig_ende?: string | null
          bisherig_kasse?: string | null
          contract_id: string
          created_at?: string
          first_name: string
          geburtsland?: string | null
          geburtsname?: string | null
          geburtsort?: string | null
          geschlecht?: Database["public"]["Enums"]["kv_geschlecht"] | null
          id?: string
          last_name: string
          relation: Database["public"]["Enums"]["family_relation"]
          staatsangehoerigkeit?: string | null
          updated_at?: string
          versicherungsnummer?: string | null
          verwandtschaft?:
            | Database["public"]["Enums"]["kv_verwandtschaft"]
            | null
        }
        Update: {
          abweichende_anschrift?: string | null
          birthdate?: string | null
          bisherig_art?: Database["public"]["Enums"]["kv_bisherig_art"] | null
          bisherig_ende?: string | null
          bisherig_kasse?: string | null
          contract_id?: string
          created_at?: string
          first_name?: string
          geburtsland?: string | null
          geburtsname?: string | null
          geburtsort?: string | null
          geschlecht?: Database["public"]["Enums"]["kv_geschlecht"] | null
          id?: string
          last_name?: string
          relation?: Database["public"]["Enums"]["family_relation"]
          staatsangehoerigkeit?: string | null
          updated_at?: string
          versicherungsnummer?: string | null
          verwandtschaft?:
            | Database["public"]["Enums"]["kv_verwandtschaft"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_family_members_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_kv_details: {
        Row: {
          contract_id: string
          created_at: string
          familienstand: Database["public"]["Enums"]["kv_familienstand"] | null
          geburtsland: string | null
          geburtsort: string | null
          geschlecht: Database["public"]["Enums"]["kv_geschlecht"] | null
          id: string
          kv_nummer: string | null
          staatsangehoerigkeit: string | null
          updated_at: string
          vorherige_kasse: string | null
          vorherige_kasse_ende: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          familienstand?: Database["public"]["Enums"]["kv_familienstand"] | null
          geburtsland?: string | null
          geburtsort?: string | null
          geschlecht?: Database["public"]["Enums"]["kv_geschlecht"] | null
          id?: string
          kv_nummer?: string | null
          staatsangehoerigkeit?: string | null
          updated_at?: string
          vorherige_kasse?: string | null
          vorherige_kasse_ende?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          familienstand?: Database["public"]["Enums"]["kv_familienstand"] | null
          geburtsland?: string | null
          geburtsort?: string | null
          geschlecht?: Database["public"]["Enums"]["kv_geschlecht"] | null
          id?: string
          kv_nummer?: string | null
          staatsangehoerigkeit?: string | null
          updated_at?: string
          vorherige_kasse?: string | null
          vorherige_kasse_ende?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_kv_details_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          commission: number | null
          created_at: string
          created_by: string | null
          customer_id: string
          details: Json
          end_date: string | null
          fremd_quelle: string | null
          household_id: string | null
          iban: string | null
          id: string
          is_fremdvertrag: boolean
          kanban_position: number
          monthly_amount: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          provider: string | null
          referenz_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          type: Database["public"]["Enums"]["contract_type"]
          updated_at: string
          vermittlungsportal: string | null
        }
        Insert: {
          commission?: number | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          details?: Json
          end_date?: string | null
          fremd_quelle?: string | null
          household_id?: string | null
          iban?: string | null
          id?: string
          is_fremdvertrag?: boolean
          kanban_position?: number
          monthly_amount?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          provider?: string | null
          referenz_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          type: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
          vermittlungsportal?: string | null
        }
        Update: {
          commission?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          details?: Json
          end_date?: string | null
          fremd_quelle?: string | null
          household_id?: string | null
          iban?: string | null
          id?: string
          is_fremdvertrag?: boolean
          kanban_position?: number
          monthly_amount?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          provider?: string | null
          referenz_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          type?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
          vermittlungsportal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sync_log: {
        Row: {
          actor_id: string | null
          application_id: string | null
          created_at: string
          entries: number
          error: string | null
          id: string
          response: Json
          status: string
        }
        Insert: {
          actor_id?: string | null
          application_id?: string | null
          created_at?: string
          entries?: number
          error?: string | null
          id?: string
          response?: Json
          status: string
        }
        Update: {
          actor_id?: string | null
          application_id?: string | null
          created_at?: string
          entries?: number
          error?: string | null
          id?: string
          response?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_sync_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_documents: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          customer_id: string
          file_name: string
          file_size: number
          hidrive_path: string
          id: string
          mime_type: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          file_name: string
          file_size: number
          hidrive_path: string
          id?: string
          mime_type: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          file_name?: string
          file_size?: number
          hidrive_path?: string
          id?: string
          mime_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          customer_id: string
          id: string
          note_type: Database["public"]["Enums"]["note_type"]
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          customer_id: string
          id?: string
          note_type?: Database["public"]["Enums"]["note_type"]
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          customer_id?: string
          id?: string
          note_type?: Database["public"]["Enums"]["note_type"]
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_relations: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          related_customer_id: string
          relation_type: Database["public"]["Enums"]["relation_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          related_customer_id: string
          relation_type: Database["public"]["Enums"]["relation_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          related_customer_id?: string
          relation_type?: Database["public"]["Enums"]["relation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "customer_relations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_relations_related_customer_id_fkey"
            columns: ["related_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          advisor_id: string | null
          assigned_to: string | null
          birthdate: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          lead_source: string | null
          lead_source_detail: string | null
          notes: string | null
          personality_type: string | null
          phone: string | null
          recorded_by: string | null
          referral_bonus_amount: number | null
          referral_notes: string | null
          referral_paid_at: string | null
          referral_status: Database["public"]["Enums"]["referral_status"] | null
          referred_by_customer_id: string | null
          salutation: string | null
          status: Database["public"]["Enums"]["customer_status"]
          street: string | null
          team_id: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          advisor_id?: string | null
          assigned_to?: string | null
          birthdate?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_source?: string | null
          lead_source_detail?: string | null
          notes?: string | null
          personality_type?: string | null
          phone?: string | null
          recorded_by?: string | null
          referral_bonus_amount?: number | null
          referral_notes?: string | null
          referral_paid_at?: string | null
          referral_status?:
            | Database["public"]["Enums"]["referral_status"]
            | null
          referred_by_customer_id?: string | null
          salutation?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          street?: string | null
          team_id?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          advisor_id?: string | null
          assigned_to?: string | null
          birthdate?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_source?: string | null
          lead_source_detail?: string | null
          notes?: string | null
          personality_type?: string | null
          phone?: string | null
          recorded_by?: string | null
          referral_bonus_amount?: number | null
          referral_notes?: string | null
          referral_paid_at?: string | null
          referral_status?:
            | Database["public"]["Enums"]["referral_status"]
            | null
          referred_by_customer_id?: string | null
          salutation?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          street?: string | null
          team_id?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_referred_by_customer_id_fkey"
            columns: ["referred_by_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_template: string
          bonus_400: boolean
          created_at: string
          id: string
          is_default: boolean
          krankenkasse: string
          name: string
          sender: string
          subject_template: string
          updated_at: string
        }
        Insert: {
          body_template: string
          bonus_400?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          krankenkasse?: string
          name: string
          sender?: string
          subject_template: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          bonus_400?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          krankenkasse?: string
          name?: string
          sender?: string
          subject_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      household_members: {
        Row: {
          created_at: string
          customer_id: string
          household_id: string
          id: string
          is_primary: boolean
          role: Database["public"]["Enums"]["household_role"]
        }
        Insert: {
          created_at?: string
          customer_id: string
          household_id: string
          id?: string
          is_primary?: boolean
          role?: Database["public"]["Enums"]["household_role"]
        }
        Update: {
          created_at?: string
          customer_id?: string
          household_id?: string
          id?: string
          is_primary?: boolean
          role?: Database["public"]["Enums"]["household_role"]
        }
        Relationships: [
          {
            foreignKeyName: "household_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          house_no: string | null
          id: string
          name: string
          notes: string | null
          postal_code: string | null
          street: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          house_no?: string | null
          id?: string
          name: string
          notes?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          house_no?: string | null
          id?: string
          name?: string
          notes?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          team_id: string
          user_id: string
        }
        Insert: {
          team_id: string
          user_id: string
        }
        Update: {
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          leader_id: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_id?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_id?: string | null
          name?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      vertriebspartner: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      whatsapp_group_contracts: {
        Row: {
          advisor_group: string
          application_id: string | null
          birth_date: string
          bonus_variant: string | null
          chat_id: string
          chat_name: string | null
          contract_date: string
          contract_date_raw: string
          created_at: string
          customer_name: string
          id: string
          krankenkasse_key: string
          krankenkasse_raw: string
          message_timestamp: string
          pdf_filename: string | null
          raw_body: string
          source: string
          status: string
          updated_at: string
          vp_normalized: string
          vp_raw: string
          wa_message_id: string
          year_month: string
        }
        Insert: {
          advisor_group: string
          application_id?: string | null
          birth_date: string
          bonus_variant?: string | null
          chat_id?: string
          chat_name?: string | null
          contract_date: string
          contract_date_raw: string
          created_at?: string
          customer_name: string
          id?: string
          krankenkasse_key: string
          krankenkasse_raw: string
          message_timestamp?: string
          pdf_filename?: string | null
          raw_body: string
          source?: string
          status?: string
          updated_at?: string
          vp_normalized: string
          vp_raw: string
          wa_message_id: string
          year_month: string
        }
        Update: {
          advisor_group?: string
          application_id?: string | null
          birth_date?: string
          bonus_variant?: string | null
          chat_id?: string
          chat_name?: string | null
          contract_date?: string
          contract_date_raw?: string
          created_at?: string
          customer_name?: string
          id?: string
          krankenkasse_key?: string
          krankenkasse_raw?: string
          message_timestamp?: string
          pdf_filename?: string | null
          raw_body?: string
          source?: string
          status?: string
          updated_at?: string
          vp_normalized?: string
          vp_raw?: string
          wa_message_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_contracts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inbox_messages: {
        Row: {
          block_id: string | null
          chat_id: string
          created_at: string | null
          id: string
          media_mime: string | null
          media_url: string | null
          processed_at: string | null
          received_at: string | null
          text: string | null
          type: string
          wa_message_id: string
        }
        Insert: {
          block_id?: string | null
          chat_id: string
          created_at?: string | null
          id?: string
          media_mime?: string | null
          media_url?: string | null
          processed_at?: string | null
          received_at?: string | null
          text?: string | null
          type: string
          wa_message_id: string
        }
        Update: {
          block_id?: string | null
          chat_id?: string
          created_at?: string | null
          id?: string
          media_mime?: string | null
          media_url?: string | null
          processed_at?: string | null
          received_at?: string | null
          text?: string | null
          type?: string
          wa_message_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_customer: {
        Args: { _customer_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_household: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_leader: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      led_team_ids: { Args: { _user_id: string }; Returns: string[] }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_team_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "user" | "haupt_vertriebler" | "mitarbeiter"
      clarification_category:
        | "zaehlerstand"
        | "km_stand"
        | "familienversicherung"
        | "unterlagen"
        | "bankdaten"
        | "widerruf"
        | "sonstiges"
      clarification_status: "offen" | "wartend" | "erledigt"
      contract_status:
        | "aktiv"
        | "in_pruefung"
        | "gekuendigt_wartet_neuabschluss"
        | "abgelaufen"
        | "storniert"
      contract_type:
        | "energie_strom"
        | "energie_gas"
        | "gkv"
        | "pkv"
        | "telekommunikation"
        | "kfz"
      customer_status: "interessent" | "kunde"
      family_relation: "ehegatte" | "kind"
      household_role:
        | "hauptperson"
        | "partner"
        | "kind"
        | "elternteil"
        | "wg_mitbewohner"
        | "sonstiges"
      kv_bisherig_art:
        | "mitgliedschaft"
        | "familienversicherung"
        | "nicht_gesetzlich"
      kv_familienstand:
        | "ledig"
        | "verheiratet"
        | "getrennt"
        | "geschieden"
        | "verwitwet"
      kv_geschlecht: "m" | "w" | "d"
      kv_verwandtschaft: "leiblich" | "stief" | "enkel" | "pflege"
      note_type: "notiz" | "anruf" | "system"
      payment_method: "selbstzahler" | "lastschrift"
      referral_status: "offen" | "zugesagt" | "ausgezahlt" | "storniert"
      relation_type:
        | "ehepartner"
        | "elternteil"
        | "kind"
        | "geschwister"
        | "verwandt"
        | "wg"
        | "freund"
        | "empfehlung_quelle"
        | "sonstiges"
      task_status: "offen" | "erledigt"
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
      app_role: ["admin", "user", "haupt_vertriebler", "mitarbeiter"],
      clarification_category: [
        "zaehlerstand",
        "km_stand",
        "familienversicherung",
        "unterlagen",
        "bankdaten",
        "widerruf",
        "sonstiges",
      ],
      clarification_status: ["offen", "wartend", "erledigt"],
      contract_status: [
        "aktiv",
        "in_pruefung",
        "gekuendigt_wartet_neuabschluss",
        "abgelaufen",
        "storniert",
      ],
      contract_type: [
        "energie_strom",
        "energie_gas",
        "gkv",
        "pkv",
        "telekommunikation",
        "kfz",
      ],
      customer_status: ["interessent", "kunde"],
      family_relation: ["ehegatte", "kind"],
      household_role: [
        "hauptperson",
        "partner",
        "kind",
        "elternteil",
        "wg_mitbewohner",
        "sonstiges",
      ],
      kv_bisherig_art: [
        "mitgliedschaft",
        "familienversicherung",
        "nicht_gesetzlich",
      ],
      kv_familienstand: [
        "ledig",
        "verheiratet",
        "getrennt",
        "geschieden",
        "verwitwet",
      ],
      kv_geschlecht: ["m", "w", "d"],
      kv_verwandtschaft: ["leiblich", "stief", "enkel", "pflege"],
      note_type: ["notiz", "anruf", "system"],
      payment_method: ["selbstzahler", "lastschrift"],
      referral_status: ["offen", "zugesagt", "ausgezahlt", "storniert"],
      relation_type: [
        "ehepartner",
        "elternteil",
        "kind",
        "geschwister",
        "verwandt",
        "wg",
        "freund",
        "empfehlung_quelle",
        "sonstiges",
      ],
      task_status: ["offen", "erledigt"],
    },
  },
} as const
