ALTER TABLE "audit_logs" ALTER COLUMN "action_type" SET DATA TYPE varchar(255);--> statement-breakpoint
CREATE INDEX "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp");