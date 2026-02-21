class AddFbclidToAhoyVisitsAndWebsiteLeads < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :ahoy_visits, :fbclid, :string
    add_column :website_leads, :fbclid, :string

    add_index :ahoy_visits, :fbclid, algorithm: :concurrently
    add_index :website_leads, :fbclid, algorithm: :concurrently
  end
end
