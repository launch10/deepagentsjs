class AddCreatedAtIndexToWebsiteLeads < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    # Index for leads page ordering (DESC for newest first)
    # Uses DESC NULLS LAST for optimal query performance
    add_index :website_leads, [:website_id, :created_at],
              order: { created_at: :desc },
              algorithm: :concurrently,
              if_not_exists: true,
              name: "index_website_leads_on_website_id_and_created_at_desc"
  end
end
