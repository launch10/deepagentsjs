class CreateUploads < ActiveRecord::Migration[8.0]
  def change
    create_table :uploads do |t|
      t.bigint :account_id, null: false
      t.string :file, null: false
      t.string :media_type, null: false
      t.uuid :uuid, null: false, default: -> { "gen_random_uuid()" }

      t.timestamps
    end

    add_index :uploads, :uuid, unique: true
    add_index :uploads, :account_id
    add_index :uploads, :media_type
    add_index :uploads, :created_at
  end
end
