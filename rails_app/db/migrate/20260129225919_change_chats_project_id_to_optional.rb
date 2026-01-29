class ChangeChatsProjectIdToOptional < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    # Make project_id optional for account-level chats (e.g., insights)
    safety_assured do
      change_column_null :chats, :project_id, true
    end

    # Update unique index to handle null project_id
    # For project-level chats: unique on (chat_type, project_id)
    # For account-level chats: unique on (chat_type, account_id) where project_id IS NULL
    remove_index :chats, [:chat_type, :project_id]
    add_index :chats, [:chat_type, :project_id], unique: true, where: "project_id IS NOT NULL", algorithm: :concurrently
    add_index :chats, [:chat_type, :account_id], unique: true, where: "project_id IS NULL", algorithm: :concurrently
  end
end
