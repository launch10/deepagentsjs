# frozen_string_literal: true

module ProjectConcerns
  module Leads
    extend ActiveSupport::Concern

    # Returns leads for this project with their conversion date.
    # Uses the website_leads.created_at as the conversion timestamp.
    #
    # @return [ActiveRecord::Relation<Lead>] Leads with conversion_date attribute
    def leads_with_conversion_date
      Lead
        .joins(website_leads: :website)
        .where(website_leads: { websites: { project_id: id } })
        .select(
          "leads.id",
          "leads.name",
          "leads.email",
          "leads.phone",
          "website_leads.created_at AS conversion_date"
        )
        .order("website_leads.created_at DESC")
    end

    # Returns the total number of leads for this project.
    #
    # @return [Integer] Count of leads
    def leads_count
      WebsiteLead
        .joins(:website)
        .where(websites: { project_id: id })
        .count
    end
  end
end
