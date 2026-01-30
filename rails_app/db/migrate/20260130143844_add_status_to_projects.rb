class AddStatusToProjects < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :projects, :status, :string, default: "draft", null: false
    add_index :projects, :status, algorithm: :concurrently
    add_index :projects, [:account_id, :status], algorithm: :concurrently
  end
end
