class CreateCampaignDeploys < ActiveRecord::Migration[8.0]
  def change
    create_table :campaign_deploys do |t|
      t.bigint :campaign_id, null: false
      t.bigint :campaign_history_id
      t.string :status, null: false, default: 'pending'
      t.string :current_step
      t.text :stacktrace

      t.timestamps

      t.index :campaign_id
      t.index :campaign_history_id
      t.index :status
      t.index :current_step
      t.index :created_at
    end
  end
end
