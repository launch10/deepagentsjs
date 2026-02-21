class AddShasumToCampaignDeploys < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :campaign_deploys, :shasum, :string
    add_index :campaign_deploys, :shasum, algorithm: :concurrently
  end
end
