class AddWebsiteStartedAtIndexToAhoyVisits < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_index :ahoy_visits, [:website_id, :started_at],
      name: "index_ahoy_visits_on_website_id_and_started_at",
      algorithm: :concurrently,
      if_not_exists: true
  end
end
