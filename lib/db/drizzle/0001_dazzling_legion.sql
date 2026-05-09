ALTER TABLE "case_access_token" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "piq_document_type" ADD COLUMN "example_pdf_content" text;--> statement-breakpoint
ALTER TABLE "piq_document_type" ADD COLUMN "example_file_name" text;