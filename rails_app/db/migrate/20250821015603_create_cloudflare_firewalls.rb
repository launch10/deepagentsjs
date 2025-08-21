class CreateCloudflareFirewalls < ActiveRecord::Migration[8.0]
  def change
    create_table :cloudflare_firewalls do |t|
      t.bigint :user_id
      t.string :status
      t.timestamp :blocked_at

      t.timestamps
      t.index :created_at
      t.index :user_id
      t.index :status
      t.index :blocked_at
    end
  end
end
