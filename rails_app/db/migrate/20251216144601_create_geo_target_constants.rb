class CreateGeoTargetConstants < ActiveRecord::Migration[8.0]
  def change
    create_table :geo_target_constants do |t|
      t.bigint :criteria_id, null: false
      t.string :name, null: false
      t.string :canonical_name, null: false
      t.bigint :parent_id
      t.string :country_code
      t.string :target_type, null: false
      t.string :status, null: false, default: "Active"

      t.timestamps
    end

    add_index :geo_target_constants, :criteria_id, unique: true
    add_index :geo_target_constants, :parent_id
    add_index :geo_target_constants, :country_code
    add_index :geo_target_constants, :target_type
    add_index :geo_target_constants, :name, using: :gin, opclass: :gin_trgm_ops
    add_index :geo_target_constants, :canonical_name, using: :gin, opclass: :gin_trgm_ops
  end
end
