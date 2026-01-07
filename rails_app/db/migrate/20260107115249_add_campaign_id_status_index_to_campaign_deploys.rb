class AddCampaignIdStatusIndexToCampaignDeploys < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_index :campaign_deploys, [:campaign_id, :status],
              algorithm: :concurrently,
              name: 'index_campaign_deploys_on_campaign_id_and_status'
  end
end
