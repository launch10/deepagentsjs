# frozen_string_literal: true

require_relative "base"

module SnapshotBuilders
  module Projects
    # Account with projects in each status for filter testing.
    #
    # Scenario:
    # - 4 projects total (fits on single page)
    # - 2 live, 1 paused, 1 draft
    # - Perfect for testing status filters
    #
    # Use for: Status filtering tests
    #
    class MixedStatuses < Base
      def base_snapshot
        "basic_account"
      end

      def output_name
        "projects/mixed_statuses"
      end

      def build
        account = Account.first
        raise "Account not found" unless account

        ensure_ads_account(account)

        # Create 4 projects with different statuses
        projects_config = [
          { name: "Active Marketing Site", status: "live" },
          { name: "Product Launch Page", status: "live" },
          { name: "Seasonal Campaign", status: "paused" },
          { name: "New Project Idea", status: "draft" }
        ]

        projects_config.each_with_index do |config, index|
          create_project_with_status(account, config[:name], status: config[:status], index: index)
        end

        puts "Created projects/mixed_statuses snapshot"
        puts "  - #{account.projects.count} total projects"
        puts "  - #{account.projects.where(status: "live").count} live"
        puts "  - #{account.projects.where(status: "paused").count} paused"
        puts "  - #{account.projects.where(status: "draft").count} draft"
      end
    end
  end
end
