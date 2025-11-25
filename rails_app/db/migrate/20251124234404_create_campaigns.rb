class CreateCampaigns < ActiveRecord::Migration[8.0]
  def change
    create_table :campaigns do |t|
      t.string :name
      t.integer :daily_budget_cents
      t.string :status, default: 'draft'
      t.string :stage, default: 'content'
      t.jsonb :platform_settings, default: { google: {}, meta: {} }
      t.datetime :launched_at
      t.string :time_zone, default: 'America/New_York'
      t.date :start_date
      t.date :end_date

      t.bigint :account_id
      t.bigint :website_id
      t.bigint :project_id

      t.timestamps
      t.index :account_id
      t.index :website_id
      t.index :project_id
      t.index :created_at
      t.index :launched_at
      t.index :status
      t.index :stage
      t.index [:account_id, :status]
      t.index [:account_id, :stage]
      t.index [:project_id, :status]
      t.index [:project_id, :stage]
      t.index :platform_settings, using: :gin
      t.index "(platform_settings->>'google')", name: "index_campaigns_on_google_id", if_not_exists: true
      t.index :start_date
      t.index :end_date
    end
  end
end
