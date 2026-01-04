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
        creates.any? || updates.any? || deletes.any?
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
