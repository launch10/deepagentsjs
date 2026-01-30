# frozen_string_literal: true

require_relative "base"

module SnapshotBuilders
  module Projects
    # Account with 8 projects for pagination testing.
    #
    # Scenario:
    # - 8 projects total (pagination shows 5 per page = 2 pages)
    # - Mix of statuses: 4 live, 2 paused, 2 draft
    # - Staggered update times for predictable ordering
    #
    # Use for: Pagination testing, status filtering
    #
    class MultiplePages < Base
      def base_snapshot
        "basic_account"
      end

      def output_name
        "projects/multiple_pages"
      end

      def build
        account = Account.first
        raise "Account not found" unless account

        ensure_ads_account(account)

        # Create 8 projects with different statuses
        projects_config = [
          { name: "E-commerce Store", status: "live" },
          { name: "SaaS Landing Page", status: "live" },
          { name: "Portfolio Site", status: "live" },
          { name: "Consulting Services", status: "live" },
          { name: "Fitness App Promo", status: "paused" },
          { name: "Restaurant Website", status: "paused" },
          { name: "Blog Platform", status: "draft" },
          { name: "Travel Agency", status: "draft" }
        ]

        projects_config.each_with_index do |config, index|
          create_project_with_status(account, config[:name], status: config[:status], index: index)
        end

        puts "Created projects/multiple_pages snapshot"
        puts "  - #{account.projects.count} total projects"
        puts "  - #{account.projects.where(status: "live").count} live"
        puts "  - #{account.projects.where(status: "paused").count} paused"
        puts "  - #{account.projects.where(status: "draft").count} draft"
      end
    end
  end
end
