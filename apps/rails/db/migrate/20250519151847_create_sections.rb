class CreateSections < ActiveRecord::Migration[8.0]
  def change
    create_table :sections do |t|
      t.string :name
      t.bigint :page_id, null: false
      t.string :component_id, null: false
      t.bigint :file_id
      t.string :theme_variation
      t.jsonb :content_plan, default: {}
      t.timestamps

      t.index :page_id
      t.index :component_id
      t.index :file_id
      t.index :created_at
    end
  end
end
