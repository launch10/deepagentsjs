class CreateAdBudgets < ActiveRecord::Migration[8.0]
  def change
    create_table :ad_budgets do |t|
      t.bigint :campaign_id
      t.integer :daily_budget_cents
      t.jsonb :platform_settings, default: { google: {}, meta: {} }
      t.timestamps

      t.index :campaign_id
      t.index :platform_settings, using: :gin
      t.index "((platform_settings->'google'->>'budget_id'))", name: "index_ad_budgets_on_google_id", if_not_exists: true
    end
  end
end
