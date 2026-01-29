# frozen_string_literal: true

require_relative "base"

module SnapshotBuilders
  module Analytics
    # Empty account with no projects at all.
    #
    # Scenario:
    # - Subscribed account, but no projects created yet
    # - Dashboard should show "Deploy Your First Project" insights
    # - Charts should show empty state
    #
    # Use for: Testing the true empty state on dashboard,
    #          verifying Langgraph returns static "get started" insights
    #
    class EmptyAccount < Base
      def base_snapshot
        "basic_account"
      end

      def output_name
        "analytics/empty_account"
      end

      def build
        account = Account.first
        raise "Account not found" unless account

        # Ensure no projects exist
        account.projects.destroy_all

        # Verify clean state
        raise "Projects should be empty" if account.projects.reload.any?

        puts "Created analytics/empty_account snapshot"
        puts "  - 0 projects"
        puts "  - Subscribed account ready for dashboard"
      end
    end
  end
end
