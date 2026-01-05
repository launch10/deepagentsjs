module GoogleAds
  class SyncResult
    attr_reader :resource_type, :resource_name, :action, :error

    # Actions that indicate local and remote are in sync
    SUCCESS_ACTIONS = [:created, :updated, :unchanged, :deleted].freeze

    def initialize(resource_type:, action:, resource_name: nil, error: nil)
      @resource_type = resource_type
      @action = action
      @resource_name = resource_name
      @error = error
    end

    # Returns true when local and remote are confirmed to be in sync
    # Used by CampaignDeploy steps to verify sync completion
    def success?
      SUCCESS_ACTIONS.include?(action)
    end

    alias_method :synced?, :success?

    def error?
      action == :error
    end

    def created?
      action == :created
    end

    def updated?
      action == :updated
    end

    def deleted?
      action == :deleted
    end

    def unchanged?
      action == :unchanged
    end

    def not_found?
      action == :not_found
    end

    def to_h
      {
        resource_type: resource_type,
        resource_name: resource_name,
        action: action,
        success: success?,
        synced: synced?,
        error: error&.message
      }
    end

    # Factory methods
    class << self
      def created(type, id = nil)
        new(resource_type: type, action: :created, resource_name: id)
      end

      def updated(type, id = nil)
        new(resource_type: type, action: :updated, resource_name: id)
      end

      def deleted(type)
        new(resource_type: type, action: :deleted)
      end

      def unchanged(type, id = nil)
        new(resource_type: type, action: :unchanged, resource_name: id)
      end

      def not_found(type)
        new(resource_type: type, action: :not_found)
      end

      def error(type, err)
        new(resource_type: type, action: :error, error: err)
      end
    end
  end
end
