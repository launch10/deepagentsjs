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

ActiveRecord::Schema[8.0].define(version: 2025_08_23_000001) do
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
    t.jsonb "metadata"
    t.boolean "transient", default: false
    t.datetime "last_used_at", precision: nil
    t.datetime "expires_at", precision: nil
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["token"], name: "index_api_tokens_on_token", unique: true
    t.index ["user_id"], name: "index_api_tokens_on_user_id"
  end

  create_table "cloudflare_firewall_rules", force: :cascade do |t|
    t.bigint "firewall_id", null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.string "status", default: "inactive", null: false
    t.string "cloudflare_rule_id", null: false
    t.datetime "blocked_at"
    t.datetime "unblocked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["blocked_at"], name: "index_cloudflare_firewall_rules_on_blocked_at"
    t.index ["cloudflare_rule_id"], name: "index_cloudflare_firewall_rules_on_cloudflare_rule_id", unique: true
    t.index ["created_at"], name: "index_cloudflare_firewall_rules_on_created_at"
    t.index ["domain_id"], name: "index_cloudflare_firewall_rules_on_domain_id", unique: true
    t.index ["firewall_id"], name: "index_cloudflare_firewall_rules_on_firewall_id"
    t.index ["status"], name: "index_cloudflare_firewall_rules_on_status"
    t.index ["unblocked_at"], name: "index_cloudflare_firewall_rules_on_unblocked_at"
    t.index ["user_id"], name: "index_cloudflare_firewall_rules_on_user_id"
  end

  create_table "cloudflare_firewalls", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "cloudflare_zone_id", null: false
    t.string "status", default: "active"
    t.datetime "blocked_at"
    t.datetime "unblocked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["blocked_at"], name: "index_cloudflare_firewalls_on_blocked_at"
    t.index ["cloudflare_zone_id"], name: "index_cloudflare_firewalls_on_cloudflare_zone_id"
    t.index ["created_at"], name: "index_cloudflare_firewalls_on_created_at"
    t.index ["status"], name: "index_cloudflare_firewalls_on_status"
    t.index ["unblocked_at"], name: "index_cloudflare_firewalls_on_unblocked_at"
    t.index ["user_id"], name: "index_cloudflare_firewalls_on_user_id"
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

  create_table "deploy_files", force: :cascade do |t|
    t.bigint "deploy_id"
    t.bigint "website_file_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_deploy_files_on_created_at"
    t.index ["deploy_id"], name: "index_deploy_files_on_deploy_id"
    t.index ["website_file_id"], name: "index_deploy_files_on_website_file_id"
  end

  create_table "deploys", force: :cascade do |t|
    t.bigint "website_id"
    t.bigint "website_history_id"
    t.string "status", null: false
    t.string "trigger", default: "manual"
    t.text "stacktrace"
    t.string "snapshot_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "is_live", default: false
    t.boolean "revertible", default: false
    t.string "version_path"
    t.string "environment", default: "production", null: false
    t.boolean "is_preview", default: false, null: false
    t.index ["created_at"], name: "index_deploys_on_created_at"
    t.index ["environment"], name: "index_deploys_on_environment"
    t.index ["is_live"], name: "index_deploys_on_is_live"
    t.index ["is_preview"], name: "index_deploys_on_is_preview"
    t.index ["revertible"], name: "index_deploys_on_revertible"
    t.index ["snapshot_id"], name: "index_deploys_on_snapshot_id"
    t.index ["status"], name: "index_deploys_on_status"
    t.index ["trigger"], name: "index_deploys_on_trigger"
    t.index ["website_history_id"], name: "index_deploys_on_website_history_id"
    t.index ["website_id", "environment", "is_preview"], name: "index_deploys_on_website_id_and_environment_and_is_preview"
    t.index ["website_id", "is_live"], name: "index_deploys_on_website_id_and_is_live"
    t.index ["website_id"], name: "index_deploys_on_website_id"
  end

  create_table "domain_request_counts", primary_key: ["id", "hour"], options: "PARTITION BY RANGE (hour)", force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "index_domain_request_counts_on_domain_hour_count"
    t.index ["domain_id", "hour"], name: "index_domain_request_counts_on_domain_id_and_hour"
    t.index ["user_id", "domain_id", "hour"], name: "index_domain_request_counts_on_user_domain_and_hour", unique: true
    t.index ["user_id", "hour"], name: "index_domain_request_counts_on_user_id_and_hour"
  end

  create_table "domain_request_counts_2025_08_01", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_08__domain_id_hour_request_count_idx"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_01_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_01_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_01_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_02", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_08_domain_id_hour_request_count_idx1"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_02_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_02_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_02_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_03", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_08_domain_id_hour_request_count_idx2"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_03_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_03_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_03_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_04", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_08_domain_id_hour_request_count_idx3"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_04_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_04_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_04_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_05", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_08_domain_id_hour_request_count_idx4"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_05_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_05_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_05_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_06", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_08_domain_id_hour_request_count_idx5"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_06_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_06_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_06_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_07", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_08_domain_id_hour_request_count_idx6"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_07_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_07_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_07_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_08", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_08_domain_id_hour_request_count_idx7"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_08_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_08_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_08_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_09", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_08_domain_id_hour_request_count_idx8"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_09_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_09_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_09_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_10", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_08_domain_id_hour_request_count_idx9"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_10_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_10_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_10_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_11", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx10"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_11_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_11_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_11_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_12", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx11"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_12_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_12_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_12_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_13", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx12"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_13_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_13_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_13_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_14", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx13"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_14_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_14_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_14_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_15", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx14"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_15_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_15_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_15_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_16", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx15"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_16_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_16_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_16_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_17", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx16"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_17_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_17_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_17_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_18", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx17"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_18_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_18_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_18_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_19", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx18"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_19_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_19_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_19_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_20", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx19"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_20_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_20_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_20_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_21", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx20"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_21_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_21_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_21_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_22", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx21"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_22_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_22_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_22_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_23", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx22"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_23_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_23_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_23_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_24", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx23"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_24_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_24_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_24_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_25", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx24"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_25_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_25_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_25_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_26", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx25"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_26_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_26_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_26_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_27", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx26"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_27_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_27_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_27_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_28", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx27"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_28_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_28_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_28_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_29", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx28"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_29_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_29_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_29_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_30", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx29"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_30_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_30_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_30_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_08_31", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx30"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_08_31_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_08_31_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_08_31_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_01", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_09__domain_id_hour_request_count_idx"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_01_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_01_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_01_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_02", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_09_domain_id_hour_request_count_idx1"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_02_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_02_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_02_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_03", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_09_domain_id_hour_request_count_idx2"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_03_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_03_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_03_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_04", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_09_domain_id_hour_request_count_idx3"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_04_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_04_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_04_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_05", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_09_domain_id_hour_request_count_idx4"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_05_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_05_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_05_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_06", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_09_domain_id_hour_request_count_idx5"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_06_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_06_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_06_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_07", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_09_domain_id_hour_request_count_idx6"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_07_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_07_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_07_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_08", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_09_domain_id_hour_request_count_idx7"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_08_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_08_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_08_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_09", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_09_domain_id_hour_request_count_idx8"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_09_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_09_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_09_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_10", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_09_domain_id_hour_request_count_idx9"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_10_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_10_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_10_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_11", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx31"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_11_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_11_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_11_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_12", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx32"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_12_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_12_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_12_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_13", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx33"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_13_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_13_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_13_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_14", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx34"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_14_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_14_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_14_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_15", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx35"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_15_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_15_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_15_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_16", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx36"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_16_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_16_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_16_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_17", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx37"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_17_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_17_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_17_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_18", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx38"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_18_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_18_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_18_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_19", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx39"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_19_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_19_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_19_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_20", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx40"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_20_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_20_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_20_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_21", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx41"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_21_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_21_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_21_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_22", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx42"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_22_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_22_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_22_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_23", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx43"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_23_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_23_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_23_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_24", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx44"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_24_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_24_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_24_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_25", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx45"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_25_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_25_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_25_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_26", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx46"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_26_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_26_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_26_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_27", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx47"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_27_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_27_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_27_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_28", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx48"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_28_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_28_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_28_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_29", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx49"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_29_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_29_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_29_user_id_hour_idx"
  end

  create_table "domain_request_counts_2025_09_30", primary_key: ["id", "hour"], options: "INHERITS (domain_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('domain_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "domain_id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "hour", null: false
    t.timestamptz "created_at", null: false
    t.index ["domain_id", "hour", "request_count"], name: "domain_request_counts_2025_0_domain_id_hour_request_count_idx50"
    t.index ["domain_id", "hour"], name: "domain_request_counts_2025_09_30_domain_id_hour_idx"
    t.index ["user_id", "domain_id", "hour"], name: "domain_request_counts_2025_09_30_user_id_domain_id_hour_idx", unique: true
    t.index ["user_id", "hour"], name: "domain_request_counts_2025_09_30_user_id_hour_idx"
  end

  create_table "domains", force: :cascade do |t|
    t.string "domain"
    t.bigint "website_id"
    t.bigint "user_id"
    t.string "cloudflare_zone_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["cloudflare_zone_id"], name: "index_domains_on_cloudflare_zone_id"
    t.index ["created_at"], name: "index_domains_on_created_at"
    t.index ["domain"], name: "index_domains_on_domain"
    t.index ["user_id"], name: "index_domains_on_user_id"
    t.index ["website_id"], name: "index_domains_on_website_id"
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

  create_table "noticed_events", force: :cascade do |t|
    t.bigint "account_id"
    t.string "type"
    t.string "record_type"
    t.bigint "record_id"
    t.jsonb "params"
    t.integer "notifications_count"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
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

  create_table "plan_limits", force: :cascade do |t|
    t.bigint "plan_id"
    t.string "limit_type"
    t.integer "limit"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_plan_limits_on_created_at"
    t.index ["limit"], name: "index_plan_limits_on_limit"
    t.index ["limit_type"], name: "index_plan_limits_on_limit_type"
    t.index ["plan_id", "limit_type"], name: "index_plan_limits_on_plan_id_and_limit_type", unique: true
    t.index ["plan_id"], name: "index_plan_limits_on_plan_id"
  end

  create_table "plans", force: :cascade do |t|
    t.string "name", null: false
    t.integer "amount", default: 0, null: false
    t.string "interval", null: false
    t.jsonb "details"
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
    t.index ["created_at"], name: "index_plans_on_created_at"
    t.index ["name"], name: "index_plans_on_name", unique: true
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

  create_table "user_request_counts", primary_key: ["id", "month"], options: "PARTITION BY RANGE (month)", force: :cascade do |t|
    t.bigserial "id", null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "month", null: false
    t.timestamptz "created_at", null: false
    t.index ["user_id", "month", "request_count"], name: "index_user_request_counts_on_user_month", unique: true
    t.index ["user_id", "month"], name: "index_user_request_counts_on_user_id_and_month"
  end

  create_table "user_request_counts_2025_08", primary_key: ["id", "month"], options: "INHERITS (user_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('user_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "month", null: false
    t.timestamptz "created_at", null: false
    t.index ["user_id", "month", "request_count"], name: "user_request_counts_2025_08_user_id_month_request_count_idx", unique: true
    t.index ["user_id", "month"], name: "user_request_counts_2025_08_user_id_month_idx"
  end

  create_table "user_request_counts_2025_09", primary_key: ["id", "month"], options: "INHERITS (user_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('user_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "month", null: false
    t.timestamptz "created_at", null: false
    t.index ["user_id", "month", "request_count"], name: "user_request_counts_2025_09_user_id_month_request_count_idx", unique: true
    t.index ["user_id", "month"], name: "user_request_counts_2025_09_user_id_month_idx"
  end

  create_table "user_request_counts_2025_10", primary_key: ["id", "month"], options: "INHERITS (user_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('user_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "month", null: false
    t.timestamptz "created_at", null: false
    t.index ["user_id", "month", "request_count"], name: "user_request_counts_2025_10_user_id_month_request_count_idx", unique: true
    t.index ["user_id", "month"], name: "user_request_counts_2025_10_user_id_month_idx"
  end

  create_table "user_request_counts_2025_11", primary_key: ["id", "month"], options: "INHERITS (user_request_counts)", force: :cascade do |t|
    t.bigint "id", default: -> { "nextval('user_request_counts_id_seq'::regclass)" }, null: false
    t.bigint "user_id", null: false
    t.bigint "request_count", null: false
    t.timestamptz "month", null: false
    t.timestamptz "created_at", null: false
    t.index ["user_id", "month", "request_count"], name: "user_request_counts_2025_11_user_id_month_request_count_idx", unique: true
    t.index ["user_id", "month"], name: "user_request_counts_2025_11_user_id_month_idx"
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

  create_table "website_file_histories", force: :cascade do |t|
    t.integer "website_file_id", null: false
    t.integer "website_id", null: false
    t.integer "file_specification_id"
    t.string "path", null: false
    t.string "content", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "history_started_at", null: false
    t.datetime "history_ended_at"
    t.integer "history_user_id"
    t.string "snapshot_id"
    t.index ["created_at"], name: "index_website_file_histories_on_created_at"
    t.index ["file_specification_id"], name: "index_website_file_histories_on_file_specification_id"
    t.index ["history_ended_at"], name: "index_website_file_histories_on_history_ended_at"
    t.index ["history_started_at"], name: "index_website_file_histories_on_history_started_at"
    t.index ["history_user_id"], name: "index_website_file_histories_on_history_user_id"
    t.index ["snapshot_id"], name: "index_website_file_histories_on_snapshot_id"
    t.index ["updated_at"], name: "index_website_file_histories_on_updated_at"
    t.index ["website_file_id"], name: "index_website_file_histories_on_website_file_id"
    t.index ["website_id"], name: "index_website_file_histories_on_website_id"
  end

  create_table "website_files", force: :cascade do |t|
    t.bigint "website_id", null: false
    t.bigint "file_specification_id"
    t.string "path", null: false
    t.string "content", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_website_files_on_created_at"
    t.index ["file_specification_id"], name: "index_website_files_on_file_specification_id"
    t.index ["updated_at"], name: "index_website_files_on_updated_at"
    t.index ["website_id"], name: "index_website_files_on_website_id"
  end

  create_table "website_histories", force: :cascade do |t|
    t.integer "website_id", null: false
    t.string "name"
    t.integer "project_id"
    t.integer "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "history_started_at", null: false
    t.datetime "history_ended_at"
    t.integer "history_user_id"
    t.string "snapshot_id"
    t.string "thread_id"
    t.integer "template_id"
    t.index ["created_at"], name: "index_website_histories_on_created_at"
    t.index ["history_ended_at"], name: "index_website_histories_on_history_ended_at"
    t.index ["history_started_at"], name: "index_website_histories_on_history_started_at"
    t.index ["history_user_id"], name: "index_website_histories_on_history_user_id"
    t.index ["name"], name: "index_website_histories_on_name"
    t.index ["project_id"], name: "index_website_histories_on_project_id"
    t.index ["snapshot_id"], name: "index_website_histories_on_snapshot_id"
    t.index ["template_id"], name: "index_website_histories_on_template_id"
    t.index ["thread_id"], name: "index_website_histories_on_thread_id"
    t.index ["user_id"], name: "index_website_histories_on_user_id"
    t.index ["website_id"], name: "index_website_histories_on_website_id"
  end

  create_table "websites", force: :cascade do |t|
    t.string "name"
    t.bigint "project_id"
    t.bigint "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "thread_id"
    t.bigint "template_id"
    t.index ["created_at"], name: "index_websites_on_created_at"
    t.index ["name"], name: "index_websites_on_name"
    t.index ["project_id"], name: "index_websites_on_project_id"
    t.index ["template_id"], name: "index_websites_on_template_id"
    t.index ["thread_id"], name: "index_websites_on_thread_id", unique: true
    t.index ["user_id"], name: "index_websites_on_user_id"
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
