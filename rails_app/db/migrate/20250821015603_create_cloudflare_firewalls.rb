class CreateCloudflareFirewalls < ActiveRecord::Migration[8.0]
  def change
    create_table :cloudflare_firewalls do |t|
      t.bigint :user_id, null: false
      t.string :status, default: 'inactive'
      t.datetime :blocked_at
      t.datetime :unblocked_at
      
      t.timestamps

      t.index :created_at
      t.index :user_id
      t.index :status
      t.index :blocked_at
      t.index :unblocked_at
    end
  end
end