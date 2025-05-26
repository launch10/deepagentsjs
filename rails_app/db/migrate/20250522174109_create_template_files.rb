class CreateTemplateFiles < ActiveRecord::Migration[8.0]
  def change
    create_table :template_files do |t|
      t.bigint :template_id
      t.string :path
      t.text :content
      t.timestamps

      t.index :template_id
      t.index :path
      t.index [:template_id, :path], unique: true
    end
  end
end
