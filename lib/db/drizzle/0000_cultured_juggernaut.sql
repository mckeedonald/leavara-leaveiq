CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_storage_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"has_leave_iq" boolean DEFAULT true NOT NULL,
	"has_perform_iq" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "leave_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"case_number" text NOT NULL,
	"employee_number" text NOT NULL,
	"employee_first_name" text,
	"employee_last_name" text,
	"employee_email" text,
	"state" text DEFAULT 'INTAKE' NOT NULL,
	"display_status" text,
	"requested_start" date NOT NULL,
	"requested_end" date,
	"leave_reason_category" text NOT NULL,
	"intermittent" boolean DEFAULT false NOT NULL,
	"analysis_result" jsonb,
	"ai_recommendation" jsonb,
	"assigned_to_user_id" uuid,
	"returned_to_work_at" date,
	"deleted_at" timestamp with time zone,
	"deleted_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_case_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "case_notice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_case_id" uuid NOT NULL,
	"notice_type" text NOT NULL,
	"subject" text NOT NULL,
	"draft_content" text NOT NULL,
	"edited_content" text,
	"sent_at" timestamp with time zone,
	"sent_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_case_id" uuid NOT NULL,
	"decision_type" text NOT NULL,
	"decided_by" text NOT NULL,
	"decision_notes" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"position" text DEFAULT '',
	"role" text DEFAULT 'hr_user' NOT NULL,
	"custom_role_id" uuid,
	"hris_id" text,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "hr_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"email" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"token" text NOT NULL,
	"sent_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "hr_password_reset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_password_reset_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "org_location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"state" text NOT NULL,
	"city" text,
	"county" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"organization_id" uuid,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"source_type" text NOT NULL,
	"full_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"credentials" text NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hris_employee_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"full_name" text NOT NULL,
	"personal_email" text,
	"hire_date" date,
	"avg_hours_per_week" numeric(5, 2),
	"raw_data" jsonb,
	"last_sync_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"uploaded_by" text DEFAULT 'employee' NOT NULL,
	"file_name" text NOT NULL,
	"storage_key" text,
	"content_inline" text,
	"mime_type" text,
	"size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_access_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"token" text NOT NULL,
	"employee_email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_access_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "employee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" text,
	"full_name" text NOT NULL,
	"position" text,
	"location" text,
	"department" text,
	"manager_id" uuid,
	"manager_name" text,
	"start_date" date,
	"avg_hours_worked" numeric(5, 2),
	"work_email" text,
	"personal_email" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"linked_user_id" uuid,
	"data_source" text DEFAULT 'manual' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"hris_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product" text NOT NULL,
	"case_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"sender_type" text NOT NULL,
	"sender_id" uuid,
	"sender_name" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ada_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_number" text NOT NULL,
	"employee_number" text NOT NULL,
	"employee_first_name" text,
	"employee_last_name" text,
	"employee_email" text,
	"disability_description" text,
	"functional_limitations" text,
	"accommodation_requested" text,
	"is_temporary" boolean DEFAULT false,
	"estimated_duration" text,
	"has_physician_support" boolean,
	"additional_notes" text,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"display_status" text,
	"decision" text,
	"decision_date" date,
	"decision_notes" text,
	"hardship_justification" text,
	"assigned_to_user_id" uuid,
	"physician_cert_sent_at" timestamp with time zone,
	"physician_cert_received_at" timestamp with time zone,
	"access_token" text,
	"submitted_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ada_case_case_number_unique" UNIQUE("case_number"),
	CONSTRAINT "ada_case_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "ada_interactive_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"entry_type" text NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"author_role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approved_accommodation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"start_date" date,
	"end_date" date,
	"is_ongoing" boolean DEFAULT true NOT NULL,
	"calendar_label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_type" text NOT NULL,
	"case_id" uuid NOT NULL,
	"case_number" text,
	"title" text NOT NULL,
	"description" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" text DEFAULT '30',
	"attendee_emails" text NOT NULL,
	"organizer_email" text NOT NULL,
	"ics_generated" boolean DEFAULT false,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_knowledge_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"law_name" text NOT NULL,
	"source_url" text NOT NULL,
	"source_type" text NOT NULL,
	"last_scraped_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"content_hash" text,
	"consecutive_failures" text DEFAULT '0',
	"flagged_for_review" boolean DEFAULT false,
	"flag_reason" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"rag_document_id" uuid,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_knowledge_source_source_key_unique" UNIQUE("source_key")
);
--> statement-breakpoint
CREATE TABLE "org_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_role_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_role_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piq_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'manager' NOT NULL,
	"hris_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "piq_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "piq_employee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"personal_email" text,
	"work_email" text,
	"job_title" text,
	"department" text,
	"manager_id" uuid,
	"hris_employee_id" text,
	"hire_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piq_document_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"base_type" text NOT NULL,
	"display_label" text NOT NULL,
	"requires_supervisor_review" boolean DEFAULT false NOT NULL,
	"supervisor_review_required" boolean DEFAULT false NOT NULL,
	"requires_hr_approval" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piq_agent_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piq_agent_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"initiated_by" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"final_draft" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piq_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_number" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"initiated_by" uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_assignee_id" uuid,
	"agent_session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "piq_case_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "piq_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piq_document_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"action" text NOT NULL,
	"performed_by" uuid,
	"performed_by_role" text NOT NULL,
	"notes" text,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piq_workflow_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"step_type" text NOT NULL,
	"step_order" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" uuid,
	"assigned_by" uuid,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"feedback" text,
	"reassigned_from" uuid,
	"reassigned_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piq_signature" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"method" text NOT NULL,
	"provider" text DEFAULT 'docusign' NOT NULL,
	"provider_envelope_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"signed_at" timestamp with time zone,
	"document_storage_key" text,
	"refused_reason" text,
	"delivered_by" uuid,
	"delivery_date" timestamp with time zone,
	"employee_access_token" text,
	"employee_signature_data" text,
	"employee_signed_at" timestamp with time zone,
	"employee_comment" text,
	"manager_signature_data" text,
	"manager_signed_at" timestamp with time zone,
	"signed_pdf_content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piq_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"policy_number" text,
	"effective_date" date,
	"pdf_storage_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piq_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'manager' NOT NULL,
	"token" text NOT NULL,
	"sent_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "piq_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "piq_password_reset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "piq_password_reset_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "piq_integration_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"provider" text NOT NULL,
	"employee_id" uuid,
	"case_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"error" text,
	"retryable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piq_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_id" uuid,
	"actor_role" text,
	"ip_address" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leave_case" ADD CONSTRAINT "leave_case_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_case" ADD CONSTRAINT "leave_case_assigned_to_user_id_hr_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_notice" ADD CONSTRAINT "case_notice_leave_case_id_leave_case_id_fk" FOREIGN KEY ("leave_case_id") REFERENCES "public"."leave_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_decision" ADD CONSTRAINT "hr_decision_leave_case_id_leave_case_id_fk" FOREIGN KEY ("leave_case_id") REFERENCES "public"."leave_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_user" ADD CONSTRAINT "hr_user_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_invite" ADD CONSTRAINT "hr_invite_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_invite" ADD CONSTRAINT "hr_invite_sent_by_user_id_hr_user_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_password_reset" ADD CONSTRAINT "hr_password_reset_user_id_hr_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_location" ADD CONSTRAINT "org_location_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunk" ADD CONSTRAINT "rag_chunk_document_id_rag_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunk" ADD CONSTRAINT "rag_chunk_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_document" ADD CONSTRAINT "rag_document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris_connection" ADD CONSTRAINT "hris_connection_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hris_employee_cache" ADD CONSTRAINT "hris_employee_cache_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_document" ADD CONSTRAINT "case_document_case_id_leave_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."leave_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_access_token" ADD CONSTRAINT "case_access_token_case_id_leave_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."leave_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ada_case" ADD CONSTRAINT "ada_case_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ada_case" ADD CONSTRAINT "ada_case_assigned_to_user_id_hr_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ada_interactive_log" ADD CONSTRAINT "ada_interactive_log_case_id_ada_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."ada_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ada_interactive_log" ADD CONSTRAINT "ada_interactive_log_author_id_hr_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approved_accommodation" ADD CONSTRAINT "approved_accommodation_case_id_ada_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."ada_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_role" ADD CONSTRAINT "org_role_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_role_permission" ADD CONSTRAINT "org_role_permission_org_role_id_org_role_id_fk" FOREIGN KEY ("org_role_id") REFERENCES "public"."org_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_user" ADD CONSTRAINT "piq_user_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_employee" ADD CONSTRAINT "piq_employee_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_employee" ADD CONSTRAINT "piq_employee_manager_id_piq_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."piq_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_document_type" ADD CONSTRAINT "piq_document_type_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_agent_message" ADD CONSTRAINT "piq_agent_message_session_id_piq_agent_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."piq_agent_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_agent_message" ADD CONSTRAINT "piq_agent_message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_agent_session" ADD CONSTRAINT "piq_agent_session_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_agent_session" ADD CONSTRAINT "piq_agent_session_initiated_by_hr_user_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_case" ADD CONSTRAINT "piq_case_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_case" ADD CONSTRAINT "piq_case_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_case" ADD CONSTRAINT "piq_case_initiated_by_hr_user_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_case" ADD CONSTRAINT "piq_case_document_type_id_piq_document_type_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."piq_document_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_case" ADD CONSTRAINT "piq_case_current_assignee_id_hr_user_id_fk" FOREIGN KEY ("current_assignee_id") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_case" ADD CONSTRAINT "piq_case_agent_session_id_piq_agent_session_id_fk" FOREIGN KEY ("agent_session_id") REFERENCES "public"."piq_agent_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_document" ADD CONSTRAINT "piq_document_case_id_piq_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."piq_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_document" ADD CONSTRAINT "piq_document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_document" ADD CONSTRAINT "piq_document_created_by_hr_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_document_history" ADD CONSTRAINT "piq_document_history_document_id_piq_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."piq_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_document_history" ADD CONSTRAINT "piq_document_history_case_id_piq_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."piq_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_document_history" ADD CONSTRAINT "piq_document_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_document_history" ADD CONSTRAINT "piq_document_history_performed_by_hr_user_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_workflow_step" ADD CONSTRAINT "piq_workflow_step_case_id_piq_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."piq_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_workflow_step" ADD CONSTRAINT "piq_workflow_step_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_workflow_step" ADD CONSTRAINT "piq_workflow_step_assigned_to_hr_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_workflow_step" ADD CONSTRAINT "piq_workflow_step_assigned_by_hr_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_workflow_step" ADD CONSTRAINT "piq_workflow_step_completed_by_hr_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_workflow_step" ADD CONSTRAINT "piq_workflow_step_reassigned_from_hr_user_id_fk" FOREIGN KEY ("reassigned_from") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_signature" ADD CONSTRAINT "piq_signature_case_id_piq_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."piq_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_signature" ADD CONSTRAINT "piq_signature_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_signature" ADD CONSTRAINT "piq_signature_employee_id_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_signature" ADD CONSTRAINT "piq_signature_delivered_by_hr_user_id_fk" FOREIGN KEY ("delivered_by") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_policy" ADD CONSTRAINT "piq_policy_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_invite" ADD CONSTRAINT "piq_invite_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_invite" ADD CONSTRAINT "piq_invite_sent_by_user_id_hr_user_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_password_reset" ADD CONSTRAINT "piq_password_reset_user_id_hr_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hr_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_integration_log" ADD CONSTRAINT "piq_integration_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_integration_log" ADD CONSTRAINT "piq_integration_log_employee_id_piq_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."piq_employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_integration_log" ADD CONSTRAINT "piq_integration_log_case_id_piq_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."piq_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_audit_log" ADD CONSTRAINT "piq_audit_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_audit_log" ADD CONSTRAINT "piq_audit_log_case_id_piq_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."piq_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piq_audit_log" ADD CONSTRAINT "piq_audit_log_actor_id_hr_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."hr_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hris_emp_org_ext_idx" ON "hris_employee_cache" USING btree ("organization_id","external_id");