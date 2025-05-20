class CreateThemesToThemeLabels < ActiveRecord::Migration[8.0]
  def change
    create_table :themes_to_theme_labels do |t|
      t.bigint :theme_id, null: false
      t.bigint :theme_label_id, null: false
      t.timestamps

      t.index :theme_id
      t.index :theme_label_id
      t.index [:theme_id, :theme_label_id]
    end
  end
end
