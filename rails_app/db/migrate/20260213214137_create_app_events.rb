class CreateAppEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :app_events do |t|
      t.bigint :account_id
      t.bigint :user_id
      t.bigint :project_id
      t.bigint :campaign_id
      t.bigint :website_id
      t.string :event_name, null: false
      t.jsonb :properties, default: {}
      t.timestamps
    end

    add_index :app_events, :account_id
    add_index :app_events, :user_id
    add_index :app_events, :project_id
    add_index :app_events, :campaign_id
    add_index :app_events, :website_id

    add_index :app_events, :event_name
    add_index :app_events, :created_at
    add_index :app_events, [:event_name, :created_at]
  end
end
