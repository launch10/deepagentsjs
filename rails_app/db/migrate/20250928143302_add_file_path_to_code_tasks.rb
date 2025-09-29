class AddFilePathToCodeTasks < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :tasks, :path, :string
    add_index :tasks, :path, algorithm: :concurrently
  end
end
