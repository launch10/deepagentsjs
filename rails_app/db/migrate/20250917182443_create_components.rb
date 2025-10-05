class CreateComponents < ActiveRecord::Migration[8.0]
  def change
    create_table :components do |t|
      t.bigint :website_id, null: false
      t.bigint :page_id, null: false
      t.string :name, null: false
      t.string :path
      t.string :component_type
      t.bigint :file_specification_id, null: false
      t.integer :theme_variant_id
      t.integer :component_plan_id
      t.integer :component_content_plan_id
      t.timestamps

      t.index :name
      t.index :website_id
      t.index :page_id
      t.index [:page_id, :name], unique: true
      t.index [:website_id, :path], unique: true
      t.index :file_specification_id
      t.index :theme_variant_id
      t.index :component_plan_id
      t.index :component_content_plan_id
      t.index :component_type
    end
  end
end
