class CreatePages < ActiveRecord::Migration[8.0]
  def change
    create_table :pages do |t|
      t.string :name
      t.bigint :project_id, null: false
      t.bigint :file_id, null: false
      t.string :page_type, null: false
      t.jsonb :plan, default: {}
      t.timestamps

      t.index :project_id
      t.index [:project_id, :page_type]
      t.index :file_id
      t.index :created_at
    end
  end
end
