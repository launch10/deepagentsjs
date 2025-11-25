class CreateCampaigns < ActiveRecord::Migration[8.0]
  def change
    create_table :campaigns do |t|
      t.string :name
      t.integer :daily_budget_cents
      t.string :status, default: 'draft'
      t.string :stage, default: 'content'
      t.datetime :launched_at

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
    end
  end
end
