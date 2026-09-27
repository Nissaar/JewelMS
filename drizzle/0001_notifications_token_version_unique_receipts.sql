CREATE TABLE "notification_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" varchar(20) NOT NULL,
	"ref_id" integer NOT NULL,
	"channel" varchar(20) NOT NULL,
	"recipient" varchar(255),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notification_log_ref" ON "notification_log" USING btree ("kind","ref_id");--> statement-breakpoint
-- Merge duplicate receipts for the same sale before making sale_id unique:
-- keep the earliest (its serial number was issued first), add up print counts
-- and keep any stored file.
UPDATE "receipts" AS keep SET
	"print_count" = dup.total_prints,
	"file_url" = COALESCE(keep."file_url", dup.any_file)
FROM (
	SELECT "sale_id", MIN("id") AS keep_id, SUM("print_count") AS total_prints, MAX("file_url") AS any_file
	FROM "receipts" GROUP BY "sale_id" HAVING COUNT(*) > 1
) AS dup
WHERE keep."id" = dup.keep_id;--> statement-breakpoint
DELETE FROM "receipts" r USING "receipts" earlier
WHERE r."sale_id" = earlier."sale_id" AND r."id" > earlier."id";--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_sale_id_unique" UNIQUE("sale_id");