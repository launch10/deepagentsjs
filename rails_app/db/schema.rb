# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2025_05_22_174109) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "vector"

  create_table "account_invitations", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.bigint "invited_by_id"
    t.string "token", null: false
    t.string "name", null: false
    t.string "email", null: false
    t.jsonb "roles", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "email"], name: "index_account_invitations_on_account_id_and_email", unique: true
    t.index ["invited_by_id"], name: "index_account_invitations_on_invited_by_id"
    t.index ["token"], name: "index_account_invitations_on_token", unique: true
  end

  create_table "account_users", force: :cascade do |t|
    t.bigint "account_id"
    t.bigint "user_id"
    t.jsonb "roles", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "user_id"], name: "index_account_users_on_account_id_and_user_id", unique: true
  end

  create_table "accounts", force: :cascade do |t|
    t.string "name", null: false
    t.bigint "owner_id"
    t.boolean "personal", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "extra_billing_info"
    t.string "domain"
    t.string "subdomain"
    t.string "billing_email"
    t.integer "account_users_count", default: 0
    t.index ["owner_id"], name: "index_accounts_on_owner_id"
  end

  create_table "action_text_embeds", force: :cascade do |t|
    t.string "url"
    t.jsonb "fields"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "action_text_rich_texts", force: :cascade do |t|
    t.string "name", null: false
    t.text "body"
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.index ["record_type", "record_id", "name"], name: "index_action_text_rich_texts_uniqueness", unique: true
  end

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", precision: nil, null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", precision: nil, null: false
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "announcements", force: :cascade do |t|
    t.string "kind"
    t.string "title"
    t.datetime "published_at", precision: nil
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "api_tokens", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "token"
    t.string "name"
    t.jsonb "metadata", default: {}
    t.boolean "transient", default: false
    t.datetime "last_used_at", precision: nil
    t.datetime "expires_at", precision: nil
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["token"], name: "index_api_tokens_on_token", unique: true
    t.index ["user_id"], name: "index_api_tokens_on_user_id"
  end

  create_table "assistant", primary_key: "assistant_id", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "graph_id", null: false
    t.timestamptz "created_at", default: -> { "now()" }
    t.timestamptz "updated_at", default: -> { "now()" }
    t.jsonb "config", default: {}, null: false
    t.jsonb "metadata", default: {}, null: false
    t.integer "version", default: 1, null: false
    t.text "name"
    t.text "description"
    t.index ["config"], name: "idx_assistants_config_gin", using: :gin
    t.index ["created_at"], name: "idx_assistants_created_at"
    t.index ["graph_id"], name: "idx_assistants_graph_id"
    t.index ["metadata"], name: "idx_assistants_metadata_gin", using: :gin
    t.index ["name"], name: "idx_assistants_name"
    t.index ["updated_at"], name: "idx_assistants_updated_at"
  end

  create_table "assistant_versions", primary_key: "assistant_version_id", id: :uuid, default: nil, force: :cascade do |t|
    t.uuid "assistant_id", null: false
    t.integer "version", default: 1, null: false
    t.text "graph_id", null: false
    t.jsonb "config", default: {}, null: false
    t.jsonb "metadata", default: {}, null: false
    t.timestamptz "created_at", default: -> { "now()" }
    t.text "name"
    t.index ["assistant_id", "version"], name: "assistant_versions_assistant_id_version_idx", unique: true
    t.index ["assistant_id"], name: "idx_assistant_versions_assistant_id"
    t.index ["assistant_id"], name: "idx_assistant_versions_assistant_id_fk"
    t.index ["config"], name: "idx_assistant_versions_config_gin", using: :gin
    t.index ["created_at"], name: "idx_assistant_versions_created_at"
    t.index ["graph_id"], name: "idx_assistant_versions_graph_id"
    t.index ["metadata"], name: "idx_assistant_versions_metadata_gin", using: :gin
    t.index ["version"], name: "idx_assistant_versions_version"
  end

  create_table "checkpoint_blobs", primary_key: ["thread_id", "checkpoint_ns", "channel", "version"], force: :cascade do |t|
    t.uuid "thread_id", null: false
    t.text "checkpoint_ns", default: "", null: false
    t.text "channel", null: false
    t.text "version", null: false
    t.text "type", null: false
    t.binary "blob"
  end

  create_table "checkpoint_migrations", primary_key: "v", id: :integer, default: nil, force: :cascade do |t|
  end

  create_table "checkpoint_writes", primary_key: ["thread_id", "checkpoint_ns", "checkpoint_id", "task_id", "idx"], force: :cascade do |t|
    t.uuid "thread_id", null: false
    t.text "checkpoint_ns", default: "", null: false
    t.uuid "checkpoint_id", null: false
    t.uuid "task_id", null: false
    t.integer "idx", null: false
    t.text "channel", null: false
    t.text "type", null: false
    t.binary "blob", null: false
  end

  create_table "checkpoints", primary_key: ["thread_id", "checkpoint_ns", "checkpoint_id"], force: :cascade do |t|
    t.uuid "thread_id", null: false
    t.text "checkpoint_ns", default: "", null: false
    t.uuid "checkpoint_id", null: false
    t.uuid "parent_checkpoint_id"
    t.text "type"
    t.jsonb "checkpoint", null: false
    t.jsonb "metadata", default: {}, null: false
    t.uuid "run_id"
    t.index ["run_id"], name: "checkpoints_run_id_idx"
    t.index ["thread_id", "checkpoint_id"], name: "checkpoints_checkpoint_id_idx", order: { checkpoint_id: :desc }
  end

  create_table "connected_accounts", force: :cascade do |t|
    t.bigint "owner_id"
    t.string "provider"
    t.string "uid"
    t.string "refresh_token"
    t.datetime "expires_at", precision: nil
    t.jsonb "auth"
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.string "access_token"
    t.string "access_token_secret"
    t.string "owner_type"
    t.index ["owner_id", "owner_type"], name: "index_connected_accounts_on_owner_id_and_owner_type"
  end

  create_table "file_specifications", force: :cascade do |t|
    t.string "canonical_path"
    t.string "description"
    t.string "filetype"
    t.string "subtype"
    t.string "language"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["canonical_path"], name: "index_file_specifications_on_canonical_path"
    t.index ["filetype"], name: "index_file_specifications_on_filetype"
    t.index ["subtype"], name: "index_file_specifications_on_subtype"
  end

  create_table "icon_embeddings", force: :cascade do |t|
    t.string "key", null: false
    t.text "text", null: false
    t.vector "embedding", limit: 1536, null: false
    t.jsonb "metadata", default: {}, null: false
    t.datetime "created_at", precision: nil
    t.index ["embedding"], name: "idx_icon_embeddings_text", opclass: :vector_cosine_ops, using: :ivfflat
    t.index ["key"], name: "index_icon_embeddings_on_key", unique: true
  end

  create_table "inbound_webhooks", force: :cascade do |t|
    t.integer "status", default: 0, null: false
    t.text "body"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "langgraph_schema_migrations", primary_key: "v", id: :integer, default: nil, force: :cascade do |t|
  end

  create_table "noticed_events", force: :cascade do |t|
    t.bigint "account_id"
    t.string "type"
    t.string "record_type"
    t.bigint "record_id"
    t.jsonb "params"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "notifications_count"
    t.index ["account_id"], name: "index_noticed_events_on_account_id"
    t.index ["record_type", "record_id"], name: "index_noticed_events_on_record"
  end

  create_table "noticed_notifications", force: :cascade do |t|
    t.bigint "account_id"
    t.string "type"
    t.bigint "event_id", null: false
    t.string "recipient_type", null: false
    t.bigint "recipient_id", null: false
    t.datetime "read_at", precision: nil
    t.datetime "seen_at", precision: nil
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_noticed_notifications_on_account_id"
    t.index ["event_id"], name: "index_noticed_notifications_on_event_id"
    t.index ["recipient_type", "recipient_id"], name: "index_noticed_notifications_on_recipient"
  end

  create_table "notification_tokens", force: :cascade do |t|
    t.bigint "user_id"
    t.string "token", null: false
    t.string "platform", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_notification_tokens_on_user_id"
  end

  create_table "notifications", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.string "recipient_type", null: false
    t.bigint "recipient_id", null: false
    t.string "type"
    t.jsonb "params"
    t.datetime "read_at", precision: nil
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "interacted_at", precision: nil
    t.index ["account_id"], name: "index_notifications_on_account_id"
    t.index ["recipient_type", "recipient_id"], name: "index_notifications_on_recipient_type_and_recipient_id"
  end

  create_table "pages", force: :cascade do |t|
    t.string "name"
    t.bigint "project_id", null: false
    t.bigint "file_id", null: false
    t.string "page_type", null: false
    t.jsonb "plan", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_pages_on_created_at"
    t.index ["file_id"], name: "index_pages_on_file_id"
    t.index ["project_id", "page_type"], name: "index_pages_on_project_id_and_page_type"
    t.index ["project_id"], name: "index_pages_on_project_id"
  end

  create_table "pay_charges", force: :cascade do |t|
    t.string "processor_id", null: false
    t.integer "amount", null: false
    t.integer "amount_refunded"
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.jsonb "data"
    t.integer "application_fee_amount"
    t.string "currency"
    t.jsonb "metadata"
    t.integer "subscription_id"
    t.bigint "customer_id"
    t.string "stripe_account"
    t.string "type"
    t.index ["customer_id", "processor_id"], name: "index_pay_charges_on_customer_id_and_processor_id", unique: true
  end

  create_table "pay_customers", force: :cascade do |t|
    t.string "owner_type"
    t.bigint "owner_id"
    t.string "processor"
    t.string "processor_id"
    t.boolean "default"
    t.jsonb "data"
    t.datetime "deleted_at", precision: nil
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "stripe_account"
    t.string "type"
    t.index ["owner_type", "owner_id", "deleted_at"], name: "customer_owner_processor_index"
    t.index ["processor", "processor_id"], name: "index_pay_customers_on_processor_and_processor_id"
  end

  create_table "pay_merchants", force: :cascade do |t|
    t.string "owner_type"
    t.bigint "owner_id"
    t.string "processor"
    t.string "processor_id"
    t.boolean "default"
    t.jsonb "data"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "type"
    t.index ["owner_type", "owner_id", "processor"], name: "index_pay_merchants_on_owner_type_and_owner_id_and_processor"
  end

  create_table "pay_payment_methods", force: :cascade do |t|
    t.bigint "customer_id"
    t.string "processor_id"
    t.boolean "default"
    t.string "payment_method_type"
    t.jsonb "data"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "stripe_account"
    t.string "type"
    t.index ["customer_id", "processor_id"], name: "index_pay_payment_methods_on_customer_id_and_processor_id", unique: true
  end

  create_table "pay_subscriptions", id: :serial, force: :cascade do |t|
    t.string "name", null: false
    t.string "processor_id", null: false
    t.string "processor_plan", null: false
    t.integer "quantity", default: 1, null: false
    t.datetime "trial_ends_at", precision: nil
    t.datetime "ends_at", precision: nil
    t.datetime "created_at", precision: nil
    t.datetime "updated_at", precision: nil
    t.string "status"
    t.jsonb "data"
    t.decimal "application_fee_percent", precision: 8, scale: 2
    t.jsonb "metadata"
    t.bigint "customer_id"
    t.datetime "current_period_start"
    t.datetime "current_period_end"
    t.boolean "metered"
    t.string "pause_behavior"
    t.datetime "pause_starts_at"
    t.datetime "pause_resumes_at"
    t.string "payment_method_id"
    t.string "stripe_account"
    t.string "type"
    t.index ["customer_id", "processor_id"], name: "index_pay_subscriptions_on_customer_id_and_processor_id", unique: true
    t.index ["metered"], name: "index_pay_subscriptions_on_metered"
    t.index ["pause_starts_at"], name: "index_pay_subscriptions_on_pause_starts_at"
  end

  create_table "pay_webhooks", force: :cascade do |t|
    t.string "processor"
    t.string "event_type"
    t.jsonb "event"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "plans", force: :cascade do |t|
    t.string "name", null: false
    t.integer "amount", default: 0, null: false
    t.string "interval", null: false
    t.jsonb "details", default: {}, null: false
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.integer "trial_period_days", default: 0
    t.boolean "hidden"
    t.string "currency"
    t.integer "interval_count", default: 1
    t.string "description"
    t.string "unit_label"
    t.boolean "charge_per_unit"
    t.string "stripe_id"
    t.string "braintree_id"
    t.string "paddle_billing_id"
    t.string "paddle_classic_id"
    t.string "lemon_squeezy_id"
    t.string "fake_processor_id"
    t.string "contact_url"
  end

  create_table "project_files", force: :cascade do |t|
    t.bigint "project_id", null: false
    t.bigint "file_specification_id"
    t.string "path", null: false
    t.string "content", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_project_files_on_created_at"
    t.index ["file_specification_id"], name: "index_project_files_on_file_specification_id"
    t.index ["project_id"], name: "index_project_files_on_project_id"
    t.index ["updated_at"], name: "index_project_files_on_updated_at"
  end

  create_table "project_plans", force: :cascade do |t|
    t.bigint "project_id", null: false
    t.string "tone", null: false
    t.string "core_emotional_driver"
    t.string "attention_grabber"
    t.string "problem_statement"
    t.string "emotional_bridge"
    t.string "product_reveal"
    t.string "social_proof"
    t.string "urgency_hook"
    t.string "call_to_action"
    t.string "page_mood"
    t.string "visual_evocation"
    t.text "landing_page_copy"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_project_plans_on_created_at"
    t.index ["project_id"], name: "index_project_plans_on_project_id"
    t.index ["updated_at"], name: "index_project_plans_on_updated_at"
  end

  create_table "projects", force: :cascade do |t|
    t.string "name", null: false
    t.bigint "account_id", null: false
    t.bigint "theme_id"
    t.string "thread_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id", "created_at"], name: "index_projects_on_account_id_and_created_at"
    t.index ["account_id", "name"], name: "index_projects_on_account_id_and_name", unique: true
    t.index ["account_id", "thread_id"], name: "index_projects_on_account_id_and_thread_id", unique: true
    t.index ["account_id", "updated_at"], name: "index_projects_on_account_id_and_updated_at"
    t.index ["account_id"], name: "index_projects_on_account_id"
    t.index ["created_at"], name: "index_projects_on_created_at"
    t.index ["name"], name: "index_projects_on_name"
    t.index ["theme_id"], name: "index_projects_on_theme_id"
    t.index ["thread_id"], name: "index_projects_on_thread_id"
    t.index ["updated_at"], name: "index_projects_on_updated_at"
  end

  create_table "retry_counter", primary_key: "run_id", id: :uuid, default: nil, force: :cascade do |t|
    t.timestamptz "created_at", default: -> { "now()" }
    t.timestamptz "updated_at", default: -> { "now()" }
    t.integer "counter", default: 0
    t.index ["counter"], name: "idx_retry_counter_counter"
    t.index ["created_at"], name: "idx_retry_counter_created_at"
    t.index ["updated_at"], name: "idx_retry_counter_updated_at"
  end

  create_table "run", primary_key: "run_id", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "thread_id", null: false
    t.uuid "assistant_id", null: false
    t.timestamptz "created_at", default: -> { "now()" }
    t.timestamptz "updated_at", default: -> { "now()" }
    t.jsonb "metadata", default: {}, null: false
    t.text "status", default: "pending", null: false
    t.jsonb "kwargs", null: false
    t.text "multitask_strategy", default: "reject", null: false
    t.index ["assistant_id"], name: "idx_runs_assistant_id"
    t.index ["assistant_id"], name: "idx_runs_assistant_id_fk"
    t.index ["created_at"], name: "idx_runs_created_at"
    t.index ["metadata"], name: "idx_runs_metadata_gin", using: :gin
    t.index ["status", "created_at"], name: "idx_runs_status_created_at"
    t.index ["status"], name: "idx_runs_status"
    t.index ["thread_id", "assistant_id"], name: "idx_runs_thread_assistant"
    t.index ["thread_id"], name: "idx_runs_thread_id"
    t.index ["thread_id"], name: "idx_runs_thread_id_fk"
    t.index ["updated_at"], name: "idx_runs_updated_at"
  end

  create_table "sections", force: :cascade do |t|
    t.string "name"
    t.bigint "page_id", null: false
    t.string "component_id", null: false
    t.bigint "file_id"
    t.string "theme_variation"
    t.jsonb "content_plan", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["component_id"], name: "index_sections_on_component_id"
    t.index ["created_at"], name: "index_sections_on_created_at"
    t.index ["file_id"], name: "index_sections_on_file_id"
    t.index ["page_id"], name: "index_sections_on_page_id"
  end

  create_table "store", primary_key: ["namespace_path", "key"], force: :cascade do |t|
    t.text "namespace_path", null: false
    t.text "key", null: false
    t.jsonb "value", null: false
    t.timestamptz "created_at", default: -> { "CURRENT_TIMESTAMP" }
    t.timestamptz "updated_at", default: -> { "CURRENT_TIMESTAMP" }
    t.timestamptz "expires_at"
    t.index ["expires_at"], name: "idx_store_expires_at", where: "(expires_at IS NOT NULL)"
    t.index ["namespace_path"], name: "idx_store_namespace_path"
    t.index ["value"], name: "idx_store_value_gin", using: :gin
  end

  create_table "template_files", force: :cascade do |t|
    t.bigint "template_id"
    t.string "path"
    t.text "content"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["path"], name: "index_template_files_on_path"
    t.index ["template_id", "path"], name: "index_template_files_on_template_id_and_path", unique: true
    t.index ["template_id"], name: "index_template_files_on_template_id"
  end

  create_table "templates", force: :cascade do |t|
    t.string "name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_templates_on_name", unique: true
  end

  create_table "theme_labels", force: :cascade do |t|
    t.string "name", null: false
    t.index ["name"], name: "index_theme_labels_on_name"
  end

  create_table "themes", force: :cascade do |t|
    t.string "name", null: false
    t.jsonb "colors", default: {}
    t.jsonb "theme", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_themes_on_name"
  end

  create_table "themes_to_theme_labels", force: :cascade do |t|
    t.bigint "theme_id", null: false
    t.bigint "theme_label_id", null: false
    t.index ["theme_id", "theme_label_id"], name: "index_themes_to_theme_labels_on_theme_id_and_theme_label_id"
    t.index ["theme_id"], name: "index_themes_to_theme_labels_on_theme_id"
    t.index ["theme_label_id"], name: "index_themes_to_theme_labels_on_theme_label_id"
  end

  create_table "thread", primary_key: "thread_id", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.timestamptz "created_at", default: -> { "now()" }
    t.timestamptz "updated_at", default: -> { "now()" }
    t.jsonb "metadata", default: {}, null: false
    t.text "status", default: "idle", null: false
    t.jsonb "config", default: {}, null: false
    t.jsonb "values"
    t.jsonb "interrupts", default: {}
    t.index ["config"], name: "idx_threads_config_gin", using: :gin
    t.index ["created_at"], name: "idx_threads_created_at"
    t.index ["metadata"], name: "idx_threads_metadata_gin", using: :gin
    t.index ["status", "updated_at"], name: "idx_threads_status_updated_at"
    t.index ["status"], name: "idx_threads_status"
    t.index ["updated_at"], name: "idx_threads_updated_at"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at", precision: nil
    t.datetime "remember_created_at", precision: nil
    t.string "confirmation_token"
    t.datetime "confirmed_at", precision: nil
    t.datetime "confirmation_sent_at", precision: nil
    t.string "unconfirmed_email"
    t.string "first_name"
    t.string "last_name"
    t.string "time_zone"
    t.datetime "accepted_terms_at", precision: nil
    t.datetime "accepted_privacy_at", precision: nil
    t.datetime "announcements_read_at", precision: nil
    t.boolean "admin"
    t.datetime "created_at", precision: nil, null: false
    t.datetime "updated_at", precision: nil, null: false
    t.string "invitation_token"
    t.datetime "invitation_created_at", precision: nil
    t.datetime "invitation_sent_at", precision: nil
    t.datetime "invitation_accepted_at", precision: nil
    t.integer "invitation_limit"
    t.string "invited_by_type"
    t.bigint "invited_by_id"
    t.integer "invitations_count", default: 0
    t.string "preferred_language"
    t.boolean "otp_required_for_login"
    t.string "otp_secret"
    t.integer "last_otp_timestep"
    t.text "otp_backup_codes"
    t.jsonb "preferences"
    t.virtual "name", type: :string, as: "(((first_name)::text || ' '::text) || (COALESCE(last_name, ''::character varying))::text)", stored: true
    t.string "jti", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["invitation_token"], name: "index_users_on_invitation_token", unique: true
    t.index ["invitations_count"], name: "index_users_on_invitations_count"
    t.index ["invited_by_id"], name: "index_users_on_invited_by_id"
    t.index ["invited_by_type", "invited_by_id"], name: "index_users_on_invited_by_type_and_invited_by_id"
    t.index ["jti"], name: "index_users_on_jti", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "account_invitations", "accounts"
  add_foreign_key "account_invitations", "users", column: "invited_by_id"
  add_foreign_key "account_users", "accounts"
  add_foreign_key "account_users", "users"
  add_foreign_key "accounts", "users", column: "owner_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "api_tokens", "users"
  add_foreign_key "pay_charges", "pay_customers", column: "customer_id"
  add_foreign_key "pay_payment_methods", "pay_customers", column: "customer_id"
  add_foreign_key "pay_subscriptions", "pay_customers", column: "customer_id"
end
