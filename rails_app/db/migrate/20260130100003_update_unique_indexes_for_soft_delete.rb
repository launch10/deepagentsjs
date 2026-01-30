class UpdateUniqueIndexesForSoftDelete < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    # Projects: (account_id, name) - allow same name after soft delete
    remove_index :projects, [:account_id, :name], if_exists: true
    add_index :projects, [:account_id, :name], unique: true,
              where: "deleted_at IS NULL", algorithm: :concurrently,
              name: "index_projects_on_account_id_and_name"

    # Social links: (project_id, platform) - allow same platform after soft delete
    remove_index :social_links, [:project_id, :platform], if_exists: true
    add_index :social_links, [:project_id, :platform], unique: true,
              where: "deleted_at IS NULL", algorithm: :concurrently,
              name: "index_social_links_on_project_id_and_platform"

    # Website files: (website_id, path) - allow same path after soft delete
    remove_index :website_files, name: "index_website_files_on_website_id_and_path_unique", if_exists: true
    add_index :website_files, [:website_id, :path], unique: true,
              where: "deleted_at IS NULL", algorithm: :concurrently,
              name: "index_website_files_on_website_id_and_path_unique"

    # Website URLs: (domain_id, path) - allow same path after soft delete
    remove_index :website_urls, [:domain_id, :path], if_exists: true
    add_index :website_urls, [:domain_id, :path], unique: true,
              where: "deleted_at IS NULL", algorithm: :concurrently,
              name: "index_website_urls_on_domain_id_and_path"

    # Chats: (chat_type, project_id) - allow same chat type after soft delete
    remove_index :chats, name: "index_chats_on_chat_type_and_project_id", if_exists: true
    add_index :chats, [:chat_type, :project_id], unique: true,
              where: "project_id IS NOT NULL AND deleted_at IS NULL", algorithm: :concurrently,
              name: "index_chats_on_chat_type_and_project_id"

    # Chats: (chat_type, account_id) - allow same chat type after soft delete
    remove_index :chats, name: "index_chats_on_chat_type_and_account_id", if_exists: true
    add_index :chats, [:chat_type, :account_id], unique: true,
              where: "project_id IS NULL AND deleted_at IS NULL", algorithm: :concurrently,
              name: "index_chats_on_chat_type_and_account_id"
  end

  def down
    # Projects
    remove_index :projects, name: "index_projects_on_account_id_and_name", if_exists: true
    add_index :projects, [:account_id, :name], unique: true,
              algorithm: :concurrently,
              name: "index_projects_on_account_id_and_name"

    # Social links
    remove_index :social_links, name: "index_social_links_on_project_id_and_platform", if_exists: true
    add_index :social_links, [:project_id, :platform], unique: true,
              algorithm: :concurrently,
              name: "index_social_links_on_project_id_and_platform"

    # Website files
    remove_index :website_files, name: "index_website_files_on_website_id_and_path_unique", if_exists: true
    add_index :website_files, [:website_id, :path], unique: true,
              algorithm: :concurrently,
              name: "index_website_files_on_website_id_and_path_unique"

    # Website URLs
    remove_index :website_urls, name: "index_website_urls_on_domain_id_and_path", if_exists: true
    add_index :website_urls, [:domain_id, :path], unique: true,
              algorithm: :concurrently,
              name: "index_website_urls_on_domain_id_and_path"

    # Chats
    remove_index :chats, name: "index_chats_on_chat_type_and_project_id", if_exists: true
    add_index :chats, [:chat_type, :project_id], unique: true,
              where: "project_id IS NOT NULL", algorithm: :concurrently,
              name: "index_chats_on_chat_type_and_project_id"

    remove_index :chats, name: "index_chats_on_chat_type_and_account_id", if_exists: true
    add_index :chats, [:chat_type, :account_id], unique: true,
              where: "project_id IS NULL", algorithm: :concurrently,
              name: "index_chats_on_chat_type_and_account_id"
  end
end
