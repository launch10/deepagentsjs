class CreateAdSchedules < ActiveRecord::Migration[8.0]
  def change
    create_table :ad_schedules do |t|
      t.bigint :campaign_id, null: false

      t.string :day_of_week
      t.integer :start_hour
      t.integer :start_minute
      t.integer :end_hour
      t.integer :end_minute
      t.boolean :always_on, default: false

      # bid adjustment (Google supports this, Meta doesn't)
      t.decimal :bid_modifier, precision: 10, scale: 2 # e.g., 1.2 = 20% increase

      t.jsonb :platform_settings, default: { google: {}, meta: {} }

      t.timestamps

      t.index :campaign_id
      t.index :day_of_week
      t.index :created_at
      t.index [:campaign_id, :day_of_week]
      t.index :platform_settings, using: :gin
      t.index :always_on
      t.index "(platform_settings->>'google'->>'criterion_id')", name: "index_ad_schedules_on_criterion_id", if_not_exists: true

      t.check_constraint "start_hour >= 0 AND start_hour <= 23",
        name: "valid_start_hour"
      t.check_constraint "end_hour >= 0 AND end_hour <= 24",
        name: "valid_end_hour"
      t.check_constraint "start_minute IN (0, 15, 30, 45)",
        name: "valid_start_minute"
      t.check_constraint "end_minute IN (0, 15, 30, 45)",
        name: "valid_end_minute"
    end
  end
end
