class CreateCloudflareFirewallRules < ActiveRecord::Migration[8.0]
  def change
    create_table :cloudflare_firewall_rules do |t|
      t.bigint :firewall_id
      t.bigint :user_id
      t.string :status
      t.string :cloudflare_id
      t.timestamp :blocked_at

      t.timestamps
      t.index :created_at
      t.index :firewall_id
      t.index :user_id
      t.index :status
      t.index :cloudflare_id
      t.index [:user_id, :status]
      t.index :blocked_at
    end
  end
end
