class CreateCloudflareFirewallRules < ActiveRecord::Migration[8.0]
  def change
    create_table :cloudflare_firewall_rules do |t|
      t.bigint :firewall_id, null: false
      t.bigint :domain_id, null: false
      t.bigint :account_id, null: false
      t.string :status, null: false, default: 'inactive'
      t.string :cloudflare_rule_id, null: false
      t.datetime :blocked_at
      t.datetime :unblocked_at

      t.timestamps

      t.index :created_at
      t.index :firewall_id
      t.index :domain_id, unique: true
      t.index :account_id
      t.index :status
      t.index :cloudflare_rule_id, unique: true
      t.index :blocked_at
      t.index :unblocked_at
    end
  end
end
