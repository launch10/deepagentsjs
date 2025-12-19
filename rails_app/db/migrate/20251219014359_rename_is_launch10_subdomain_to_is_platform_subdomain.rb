class RenameIsLaunch10SubdomainToIsPlatformSubdomain < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_column :domains, :is_launch10_subdomain, :is_platform_subdomain
      rename_index :domains, 'index_domains_on_account_id_and_subdomain', 'index_domains_on_account_id_and_platform_subdomain'
    end
  end
end
