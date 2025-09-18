class CreateTasks < ActiveRecord::Migration[8.0]
  def change
    create_table :tasks do |t|
      t.string :type # CodeTask, AdsTask, etc.
      t.string :subtype # CREATE_PAGE, CREATE_COMPONENT, etc.
      t.string :title
      t.string :instructions
      t.string :status
      t.string :action
      t.bigint :file_specification_id
      t.bigint :component_id
      t.jsonb :inputs
      t.jsonb :results
      t.bigint :project_id
      t.bigint :website_id
      t.timestamps

      t.index :created_at
      t.index :type
      t.index :subtype
      t.index :status
      t.index :action
      t.index :file_specification_id
      t.index :component_id
      t.index :inputs, using: :gin
      t.index :results, using: :gin
      t.index :project_id
      t.index :website_id
    end
  end
end
