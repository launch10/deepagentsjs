class CreateThemeVariants < ActiveRecord::Migration[8.0]
  def change
    create_table :theme_variants do |t|
      t.string :background_class, null: false
      t.string :foreground_class
      t.string :muted_class
      t.string :primary_class
      t.string :secondary_class
      t.string :accent_class
      t.timestamps

      t.index :created_at
      t.index :background_class, unique: true
    end
  end
end