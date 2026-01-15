class AddUtmColumnsToWebsiteLeads < ActiveRecord::Migration[8.0]
  def change
    add_column :website_leads, :utm_source, :string
    add_column :website_leads, :utm_medium, :string
    add_column :website_leads, :utm_campaign, :string
    add_column :website_leads, :utm_content, :string
    add_column :website_leads, :utm_term, :string
  end
end
