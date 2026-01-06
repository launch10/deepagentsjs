module GoogleAds
  module Sync
    class SyncResult
      attr_reader :resource_type, :resource_name, :action, :error

      ACTIONS = [:created, :updated, :unchanged, :deleted, :not_found, :error].freeze
      SUCCESS_ACTIONS = [:created, :updated, :unchanged, :deleted].freeze

      def initialize(resource_type:, action:, resource_name: nil, comparisons: nil, error: nil, no_remote_needed: nil)
        @resource_type = resource_type
        @resource_name = resource_name
        @action = action
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

      def deleted?
        action == :deleted
      end

      def success?
        SUCCESS_ACTIONS.include?(action)
      end

      alias_method :synced?, :success?

      def to_h
        {
          resource_type: resource_type,
          resource_name: resource_name,
          action: action,
          success: success?,
          error: error&.message
        }
      end
    end
  end
end
