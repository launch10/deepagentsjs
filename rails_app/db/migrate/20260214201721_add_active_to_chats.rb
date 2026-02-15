class AddActiveToChats < ActiveRecord::Migration[8.0]
  def change
    add_column :chats, :active, :boolean, default: true, null: false

    # Replace old unique indexes with ones scoped to active chats.
    # This allows multiple inactive deploy chats per project while ensuring
    # only one active chat per type.
    safety_assured do
      remove_index :chats, name: :index_chats_on_chat_type_and_project_id
      remove_index :chats, name: :index_chats_on_chat_type_and_account_id

      add_index :chats, [:chat_type, :project_id], unique: true,
        where: "project_id IS NOT NULL AND deleted_at IS NULL AND active = true",
        name: :index_chats_on_active_chat_type_project

      add_index :chats, [:chat_type, :account_id], unique: true,
        where: "project_id IS NULL AND deleted_at IS NULL AND active = true",
        name: :index_chats_on_active_chat_type_account
    end
  end
end
