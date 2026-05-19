ALTER TABLE "odf" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "odf" ADD COLUMN "parameters" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "estimated_price" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gold_rate" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "gold_rate" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "order_id" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;