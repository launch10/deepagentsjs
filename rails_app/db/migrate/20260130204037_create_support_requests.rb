class CreateSupportRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :support_requests do |t|
      t.references :user, null: false, foreign_key: true
      t.references :account, null: false, foreign_key: true
      t.string :category, null: false
      t.string :subject, null: false
      t.text :description, null: false
      t.string :subscription_tier
      t.integer :credits_remaining
      t.string :submitted_from_url
      t.string :browser_info
      t.boolean :slack_notified, default: false
      t.boolean :notion_created, default: false
      t.boolean :email_sent, default: false
      t.timestamps
    end
  end
end
