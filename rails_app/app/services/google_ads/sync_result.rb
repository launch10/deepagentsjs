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
        error: format_error
      }
    end

    private

    # Extract meaningful details from GoogleAdsError failures.
    # The wrapper exception's .message is just the class name; the actual
    # human-readable messages live in failure.errors[].message.
    def format_error
      return nil unless error

      if error.respond_to?(:failure) && error.failure.respond_to?(:errors)
        messages = error.failure.errors.map do |e|
          parts = []
          parts << error_code_label(e) if e.respond_to?(:error_code)
          parts << e.message if e.respond_to?(:message) && e.message.present?
          parts << format_policy_details(e) if e.respond_to?(:details) && e.details
          parts.compact.join(": ")
        end
        messages.join("; ")
      else
        error.message
      end
    end

    def error_code_label(individual_error)
      code = Google::Ads::GoogleAds::Errors.code(individual_error)
      return nil if code.nil? || code.empty?

      "#{code[:name]}: #{code[:value]}"
    rescue
      nil
    end

    def format_policy_details(individual_error)
      details = individual_error.details
      return nil unless details

      parts = []
      if details.respond_to?(:policy_finding_details) && details.policy_finding_details
        topics = details.policy_finding_details.policy_topic_entries.map do |entry|
          "#{entry.topic} (#{entry.type})"
        end
        parts << "policy_topics: [#{topics.join(", ")}]" if topics.any?
      end

      if details.respond_to?(:policy_violation_details) && details.policy_violation_details
        pv = details.policy_violation_details
        parts << "policy: #{pv.external_policy_name}" if pv.respond_to?(:external_policy_name)
        parts << "exemptible: #{pv.is_exemptible}" if pv.respond_to?(:is_exemptible)
      end

      parts.any? ? parts.join(", ") : nil
    end

    public

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
