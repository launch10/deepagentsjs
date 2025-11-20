class AddThemeTypeAndAuthorIdToThemes < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :themes, :theme_type, :string
    add_column :themes, :author_id, :bigint

    add_index :themes, :theme_type, algorithm: :concurrently
    add_index :themes, :author_id, algorithm: :concurrently
  end
end
