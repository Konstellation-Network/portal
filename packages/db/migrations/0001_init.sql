CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" uuid,
	"action" text NOT NULL,
	"target" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiat_balances" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance_kobo" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "fiat_balances_not_negative" CHECK ("fiat_balances"."balance_kobo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "fiat_ledger" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fiat_ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"amount_kobo" bigint NOT NULL,
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiat_ledger_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "fiat_ledger_amount_nonzero" CHECK ("fiat_ledger"."amount_kobo" <> 0),
	CONSTRAINT "fiat_ledger_kind" CHECK ("fiat_ledger"."kind" in ('topup', 'purchase', 'refund', 'adjustment'))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"price_kobo" bigint NOT NULL,
	"status" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "orders_status" CHECK ("orders"."status" in ('paid', 'refunded'))
);
--> statement-breakpoint
CREATE TABLE "pouch_customers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"virtual_account_id" text NOT NULL,
	"account_number" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pouch_customers_customer_id_unique" UNIQUE("customer_id"),
	CONSTRAINT "pouch_customers_virtual_account_id_unique" UNIQUE("virtual_account_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"sku" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_kobo" bigint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "products_price_positive" CHECK ("products"."price_kobo" > 0)
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"ip_hmac" "bytea",
	"ua_hmac" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "streak_shields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"start_window" bigint NOT NULL,
	"end_window" bigint NOT NULL,
	CONSTRAINT "streak_shields_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "streak_shields_range" CHECK ("streak_shields"."end_window" >= "streak_shields"."start_window")
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"last_window" bigint
);
--> statement-breakpoint
CREATE TABLE "taps" (
	"user_id" uuid NOT NULL,
	"window_idx" bigint NOT NULL,
	"xp" integer NOT NULL,
	"source" text DEFAULT 'tap' NOT NULL,
	"ip_hmac" "bytea",
	"ua_hmac" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "taps_user_id_window_idx_pk" PRIMARY KEY("user_id","window_idx"),
	CONSTRAINT "taps_source" CHECK ("taps"."source" in ('tap', 'auto_streak'))
);
--> statement-breakpoint
CREATE TABLE "user_xp" (
	"user_id" uuid NOT NULL,
	"season_id" integer NOT NULL,
	"xp" bigint DEFAULT 0 NOT NULL,
	"reached_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_xp_user_id_season_id_pk" PRIMARY KEY("user_id","season_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decane_user_id" text NOT NULL,
	"evm_address" text NOT NULL,
	"username" "citext",
	"username_set_at" timestamp with time zone,
	"tap_offset_s" integer NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_decane_user_id_unique" UNIQUE("decane_user_id"),
	CONSTRAINT "users_evm_address_unique" UNIQUE("evm_address"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_evm_address_format" CHECK ("users"."evm_address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "users_username_format" CHECK ("users"."username" ~ '^[a-z0-9_]{3,20}$'),
	CONSTRAINT "users_tap_offset_range" CHECK ("users"."tap_offset_s" between 0 and 3599),
	CONSTRAINT "users_role" CHECK ("users"."role" in ('user', 'admin')),
	CONSTRAINT "users_status" CHECK ("users"."status" in ('active', 'banned'))
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"event_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "webhook_events_provider_event_key" UNIQUE("provider","event_key")
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "xp_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"season_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"source" text NOT NULL,
	"source_ref" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"reverses_id" bigint,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xp_events_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "xp_events_amount_nonzero" CHECK ("xp_events"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiat_balances" ADD CONSTRAINT "fiat_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiat_ledger" ADD CONSTRAINT "fiat_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_sku_products_sku_fk" FOREIGN KEY ("sku") REFERENCES "public"."products"("sku") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pouch_customers" ADD CONSTRAINT "pouch_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streak_shields" ADD CONSTRAINT "streak_shields_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streak_shields" ADD CONSTRAINT "streak_shields_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taps" ADD CONSTRAINT "taps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_xp" ADD CONSTRAINT "user_xp_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_xp" ADD CONSTRAINT "user_xp_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_reverses_id_xp_events_id_fk" FOREIGN KEY ("reverses_id") REFERENCES "public"."xp_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fiat_ledger_user_idx" ON "fiat_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_family_idx" ON "sessions" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "streak_shields_user_end_idx" ON "streak_shields" USING btree ("user_id","end_window");--> statement-breakpoint
CREATE INDEX "user_xp_rank_idx" ON "user_xp" USING btree ("season_id","xp" DESC NULLS LAST,"reached_at");--> statement-breakpoint
CREATE INDEX "xp_events_user_season_idx" ON "xp_events" USING btree ("user_id","season_id");