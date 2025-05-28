class CreateProjectFiles < ActiveRecord::Migration[8.0]
  def change
    create_table :project_files do |t|
      t.bigint :project_id, null: false
      t.bigint :file_specification_id
      t.string :path, null: false
      t.string :content, null: false

      t.timestamps

      t.index :project_id
      t.index :file_specification_id
      t.index :created_at
      t.index :updated_at
    end
  end
end
