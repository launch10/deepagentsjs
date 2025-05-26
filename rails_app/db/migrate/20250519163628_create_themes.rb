class CreateThemes < ActiveRecord::Migration[8.0]
  def change
    create_table :themes do |t|
      t.string :name, null: false
      t.jsonb :colors, default: {}
      t.jsonb :theme, default: {}
      t.timestamps

      t.index :name
    end
  end
end
