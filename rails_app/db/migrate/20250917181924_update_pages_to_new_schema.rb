class UpdatePagesToNewSchema < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      remove_column :pages, :project_id
      add_column :pages, :website_id, :bigint
      add_index :pages, :website_id

      remove_column :pages, :file_id
      add_column :pages, :website_file_id, :bigint
      add_index :pages, :website_file_id

      remove_column :pages, :plan

      add_column :pages, :path, :string
      add_index :pages, :path

      add_column :pages, :file_specification_id, :bigint
      add_index :pages, :file_specification_id
    end
  end
end