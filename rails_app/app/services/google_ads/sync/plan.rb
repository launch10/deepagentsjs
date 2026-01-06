module GoogleAds
  module Sync
    class Plan
      attr_reader :operations

      def initialize(operations = [])
        @operations = operations
      end

      def creates
        operations.select { |op| op[:action] == :create }
      end

      def updates
        operations.select { |op| op[:action] == :update }
      end

      def deletes
        operations.select { |op| op[:action] == :delete }
      end

      def unchanged
        operations.select { |op| op[:action] == :unchanged }
      end

      def any_changes?
        operations.any? { |op| op[:action] != :unchanged }
      end

      def budgets
        Plan.new(operations.select { |op| op[:record].is_a?(AdBudget) })
      end

      def campaigns
        Plan.new(operations.select { |op| op[:record].is_a?(Campaign) })
      end

      def location_targets
        Plan.new(operations.select { |op| op[:record].is_a?(AdLocationTarget) })
      end

      def ad_groups
        Plan.new(operations.select { |op| op[:record].is_a?(AdGroup) })
      end

      def keywords
        Plan.new(operations.select { |op| op[:record].is_a?(AdKeyword) })
      end

      def ads
        Plan.new(operations.select { |op| op[:record].is_a?(Ad) })
      end

      def only_changes
        self.class.new(operations.reject { |op| op[:action] == :unchanged })
      end

      def empty?
        operations.empty?
      end

      def to_h
        {
          creates: creates.size,
          updates: updates.size,
          deletes: deletes.size,
          unchanged: unchanged.size,
          any_changes: any_changes?,
          operations: operations
        }
      end

      def self.merge(*plans)
        combined_operations = plans.flat_map(&:operations)
        new(combined_operations)
      end
    end
  end
end
