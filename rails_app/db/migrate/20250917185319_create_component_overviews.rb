class CreateComponentOverviews < ActiveRecord::Migration[8.0]
  def change
    create_table :component_overviews do |t|
      t.bigint :website_id, null: false
      t.bigint :page_id
      t.string :component_type
      t.string :name
      t.string :path
      t.bigint :component_id
      t.bigint :file_specification_id
      t.string :purpose
      t.string :context
      t.string :copy
      t.string :background_color

      t.timestamps

      t.index :created_at
      t.index :website_id
      t.index :page_id
      t.index :component_type
      t.index :name
      t.index :component_id
      t.index :file_specification_id
      t.index :path
    end
  end
end
