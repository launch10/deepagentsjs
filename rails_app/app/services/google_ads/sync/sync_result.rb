module GoogleAds
  module Sync
    class SyncResult
      attr_reader :resource_type, :resource_name, :action, :comparisons, :error

      ACTIONS = [:created, :updated, :unchanged, :not_found, :error].freeze

      def initialize(resource_type:, action:, resource_name: nil, comparisons: [], error: nil)
        @resource_type = resource_type
        @resource_name = resource_name
        @action = action
        @comparisons = comparisons
        @error = error
      end

      def created?
        action == :created
      end

      def updated?
        action == :updated
      end

      def unchanged?
        action == :unchanged
      end

      def not_found?
        action == :not_found
      end

      def error?
        action == :error
      end

      def success?
        [:created, :updated, :unchanged].include?(action)
      end

      def synced?
        comparisons.any? && values_match?
      end

      def values_match?
        comparisons.all?(&:values_match?)
      end

      def mismatched_fields
        comparisons.reject(&:values_match?)
      end

      def matched_fields
        comparisons.select(&:values_match?)
      end

      def comparison_for(field)
        comparisons.find { |c| c.field == field }
      end

      def to_h
        {
          resource_type: resource_type,
          resource_name: resource_name,
          action: action,
          success: success?,
          synced: synced?,
          comparisons: comparisons.map(&:to_h),
          mismatched_fields: mismatched_fields.map(&:field),
          error: error&.message
        }
      end
    end
  end
end
