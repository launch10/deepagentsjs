class RenameDeploysToWebsiteDeploys < ActiveRecord::Migration[8.0]
  def change
    safety_assured { rename_table :deploys, :website_deploys }
  end
end
