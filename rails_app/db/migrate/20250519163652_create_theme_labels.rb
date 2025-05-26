class CreateThemeLabels < ActiveRecord::Migration[8.0]
  def change
    create_table :theme_labels do |t|
      t.string :name, null: false

      t.index :name
    end
  end
end
