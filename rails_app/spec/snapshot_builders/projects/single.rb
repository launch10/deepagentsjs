# frozen_string_literal: true

require_relative "base"

module SnapshotBuilders
  module Projects
    # Account with exactly 1 project for edge case testing.
    #
    # Scenario:
    # - Single live project
    # - Tests pagination edge case (should not show pagination)
    # - Tests deletion flow (what happens with last project)
    #
    # Use for: Pagination edge cases, deletion tests
    #
    class Single < Base
      def base_snapshot
        "basic_account"
      end

      def output_name
        "projects/single"
      end

      def build
        account = Account.first
        raise "Account not found" unless account

        ensure_ads_account(account)

        # Create single live project
        create_project_with_status(account, "My Only Project", status: "live", index: 0)

        puts "Created projects/single snapshot"
        puts "  - #{account.projects.count} project"
        puts "  - Status: #{account.projects.first.status}"
      end
    end
  end
end
