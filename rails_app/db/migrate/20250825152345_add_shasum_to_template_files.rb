class AddShasumToTemplateFiles < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :template_files, :shasum, :string
    add_index :template_files, :shasum, algorithm: :concurrently
  end
end
