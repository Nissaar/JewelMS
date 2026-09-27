CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action_type" varchar(50) NOT NULL,
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(100),
	"address" text,
	"phone_number" varchar(20),
	"id_number" varchar(100),
	"risk_rating" varchar(20) DEFAULT 'Low' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_id_number_unique" UNIQUE("id_number")
);
--> statement-breakpoint
CREATE TABLE "odf" (
	"id" serial PRIMARY KEY NOT NULL,
	"odf_serial_number" serial NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_id" integer,
	"item_reserved_repair" text,
	"description" text,
	"comments" text,
	"weight" numeric(10, 3),
	"metal_type" varchar(50),
	"fineness" varchar(20),
	"amount" numeric(15, 2),
	"image_url" text,
	"file_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odf_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"odf_id" integer NOT NULL,
	"description" text NOT NULL,
	"mass" numeric(10, 3) NOT NULL,
	"fineness" varchar(20) NOT NULL,
	"price" numeric(15, 2) DEFAULT '0.00',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" serial NOT NULL,
	"customer_id" integer,
	"item_description" text,
	"estimated_weight" numeric(10, 3),
	"estimated_price" numeric(15, 2),
	"deposit" numeric(15, 2),
	"final_weight" numeric(10, 3),
	"final_price" numeric(15, 2),
	"status" varchar(20) DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_serial_number" serial NOT NULL,
	"sale_id" integer NOT NULL,
	"print_count" integer DEFAULT 0 NOT NULL,
	"file_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"functionality" varchar(50) NOT NULL,
	"can_view" boolean DEFAULT false NOT NULL,
	"can_create" boolean DEFAULT false NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_permissions_user_id_functionality_unique" UNIQUE("user_id","functionality")
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"stock_id" integer,
	"barcode" varchar(100),
	"item_details" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit_sales_price" numeric(15, 2),
	"amount" numeric(15, 2),
	"weight" numeric(10, 3),
	"fineness" varchar(20),
	"metal_type" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"stock_id" integer,
	"datetime" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_mode" varchar(20) NOT NULL,
	"cheque_number" varchar(50),
	"qty" integer DEFAULT 1 NOT NULL,
	"item_details" text,
	"weight" numeric(10, 3),
	"fineness" varchar(20),
	"unit_sales_price" numeric(15, 2),
	"amount" numeric(15, 2),
	"discount_amount" numeric(15, 2),
	"discount_percentage" numeric(5, 2),
	"vat_15" numeric(15, 2),
	"metal_type" varchar(50),
	"order_id" integer,
	"linked_odf_id" integer,
	"linked_commande_id" integer,
	"status" varchar(20) DEFAULT 'Completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"barcode" varchar(100) NOT NULL,
	"item_code" varchar(100),
	"category" varchar(100) NOT NULL,
	"sub_category" varchar(100),
	"stock_type" varchar(20) NOT NULL,
	"brand" varchar(100),
	"years_of_guarantee" integer DEFAULT 0,
	"serial_number" varchar(100),
	"metal_type" varchar(50),
	"fineness" varchar(20),
	"weight_grams" numeric(10, 3),
	"price" numeric(15, 2) DEFAULT '0.00',
	"price_net" numeric(15, 2) DEFAULT '0.00',
	"price_vat" numeric(15, 2) DEFAULT '0.00',
	"status" varchar(20) DEFAULT 'Disponible' NOT NULL,
	"sold_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(100) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) DEFAULT 'User' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odf" ADD CONSTRAINT "odf_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odf_items" ADD CONSTRAINT "odf_items_odf_id_odf_id_fk" FOREIGN KEY ("odf_id") REFERENCES "public"."odf"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_stock_id_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stock"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_stock_id_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stock"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_linked_odf_id_odf_id_fk" FOREIGN KEY ("linked_odf_id") REFERENCES "public"."odf"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_linked_commande_id_orders_id_fk" FOREIGN KEY ("linked_commande_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_customers_id_number" ON "customers" USING btree ("id_number");--> statement-breakpoint
CREATE INDEX "idx_stock_item_code" ON "stock" USING btree ("item_code");