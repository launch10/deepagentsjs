class RemoveLocationIdentifierFromAdLocationTargets < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    safety_assured do
      remove_index :ad_location_targets, :location_identifier, if_exists: true
      remove_index :ad_location_targets, :platform_ids, if_exists: true
      remove_column :ad_location_targets, :location_identifier, :string
    end

    add_index :ad_location_targets, "(platform_ids->>'google')", name: "index_ad_location_targets_on_google_id", algorithm: :concurrently, if_not_exists: true
  end
end
