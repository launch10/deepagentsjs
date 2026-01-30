# frozen_string_literal: true

require_relative "base"

module SnapshotBuilders
  module Projects
    # Account with no projects for empty state testing.
    #
    # Scenario:
    # - Account exists with subscription
    # - No projects created yet
    # - Tests the empty state UI
    #
    # Use for: Empty state display, new user experience
    #
    class Empty < Base
      def base_snapshot
        "basic_account"
      end

      def output_name
        "projects/empty"
      end

      def build
        account = Account.first
        raise "Account not found" unless account

        # Ensure no projects exist (basic_account shouldn't have any)
        account.projects.destroy_all

        puts "Created projects/empty snapshot"
        puts "  - #{account.projects.count} projects (should be 0)"
      end
    end
  end
end
