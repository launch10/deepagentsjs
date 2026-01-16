class CreateModelConfigs < ActiveRecord::Migration[8.0]
  def change
    create_table :model_configs do |t|
      t.string :model_key, null: false
      t.boolean :enabled, null: false, default: true
      t.integer :max_usage_percent, default: 100
      t.decimal :cost_in, precision: 10, scale: 4
      t.decimal :cost_out, precision: 10, scale: 4

      t.timestamps
    end
    add_index :model_configs, :model_key, unique: true
  end
end
