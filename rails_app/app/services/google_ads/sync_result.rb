module GoogleAds
  class SyncResult
    attr_reader :resource_type, :resource_name, :action, :error

    def initialize(resource_type:, action:, resource_name: nil, error: nil)
      @resource_type = resource_type
      @action = action
      @resource_name = resource_name
      @error = error
    end

    def success?
      action != :error
    end

    def synced?
      %i[unchanged created updated deleted].include?(action)
    end

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
