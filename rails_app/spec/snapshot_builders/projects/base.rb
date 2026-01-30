# frozen_string_literal: true

require_relative "../base_builder"

module SnapshotBuilders
  module Projects
    # Base class for projects snapshot builders.
    #
    # Provides helpers to:
    # - Create projects with different statuses
    # - Set up websites and deploys
    # - Create campaigns with different statuses
    #
    class Base < ::BaseBuilder
      private

      # Create a project with the specified status.
      #
      # @param account [Account]
      # @param name [String]
      # @param status [String] "draft", "paused", or "live"
      # @param index [Integer] used to stagger timestamps
      # @return [Project]
      #
      def create_project_with_status(account, name, status:, index: 0)
        # Create project with staggered timestamps for ordering
        project = account.projects.create!(
          name: name,
          created_at: (30 - index).days.ago,
          updated_at: (index + 1).days.ago
        )

        # Create workflow
        workflow_step = (status == "draft") ? "brainstorm" : "deploy"
        project.workflows.create!(
          workflow_type: "launch",
          step: workflow_step,
          substep: 0
        )

        # Create website
        website = Website.create!(
          account: account,
          project: project,
          name: name,
          theme: Theme.first || create(:theme),
          template: Template.first || create(:template)
        )

        # Create domain and website URL for non-draft projects
        # Use custom domains to avoid platform subdomain limits
        if status != "draft"
          domain = Domain.new(
            website: website,
            account: account,
            domain: "#{name.parameterize}-#{index}.test-domain.com"
          )
          domain.save!(validate: false) # Skip subdomain limit validation for test data

          # Create WebsiteUrl to link website to domain (required for primary_url_string)
          WebsiteUrl.create!(
            website: website,
            domain: domain,
            account: account,
            path: "/"
          )
        end

        case status
        when "live"
          # Create completed deploy
          project.deploys.create!(
            status: "completed",
            is_live: true
          )
        when "paused"
          # Create deploy and paused campaign
          project.deploys.create!(
            status: "completed",
            is_live: true
          )
          create_paused_campaign(project)
        end

        # Refresh status to match actual state
        project.refresh_status!
        project
      end

      # Create a paused campaign for a project.
      #
      # @param project [Project]
      # @return [Campaign]
      #
      def create_paused_campaign(project)
        result = Campaign.create_campaign!(project.account, {
          name: "#{project.name} Campaign",
          project_id: project.id,
          website_id: project.website.id
        })

        campaign = result[:campaign]
        campaign.update_columns(
          status: "paused",
          launched_at: 7.days.ago
        )

        campaign
      end

      # Ensure ads account exists for the account
      def ensure_ads_account(account)
        return if account.ads_account.present?

        AdsAccount.create!(
          account: account,
          platform: "google",
          google_customer_id: "123-456-#{account.id.to_s.rjust(4, "0")}"
        )
      end
    end
  end
end
