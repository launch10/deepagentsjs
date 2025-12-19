class AddIsPlatformSubdomainToDomains < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :domains, :is_platform_subdomain, :boolean, default: false, null: false
    add_index :domains, [:account_id, :is_platform_subdomain], name: 'index_domains_on_account_id_and_platform_subdomain', algorithm: :concurrently
  end
end
