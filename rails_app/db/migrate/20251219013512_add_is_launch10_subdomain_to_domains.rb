class AddIsLaunch10SubdomainToDomains < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :domains, :is_launch10_subdomain, :boolean, default: false, null: false
    add_index :domains, [:account_id, :is_launch10_subdomain], name: 'index_domains_on_account_id_and_subdomain', algorithm: :concurrently
  end
end
