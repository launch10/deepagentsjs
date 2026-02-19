module GoogleAds
  module TerminalErrors
    # Terminal error codes that will never succeed on retry.
    # Pairs are [error_category, error_value] matching the entries from
    # individual_error.error_code.to_h (e.g. {campaign_error: :DUPLICATE_CAMPAIGN_NAME}).
    TERMINAL_CODES = Set[
      # Campaign
      [:campaign_error, :DUPLICATE_CAMPAIGN_NAME],
      [:campaign_error, :CAMPAIGN_NOT_FOUND],
      # Budget
      [:campaign_budget_error, :DUPLICATE_NAME],
      [:campaign_budget_error, :MONEY_AMOUNT_IN_WRONG_CURRENCY],
      # Ad Group
      [:ad_group_error, :DUPLICATE_ADGROUP_NAME],
      # Keywords
      [:criterion_error, :INVALID_KEYWORD_TEXT],
      [:criterion_error, :KEYWORD_TEXT_TOO_LONG],
      [:criterion_error, :KEYWORD_HAS_TOO_MANY_WORDS],
      # Policy
      [:policy_finding_error, :POLICY_FINDING],
      # Auth / Customer
      [:authorization_error, :USER_PERMISSION_DENIED],
      [:customer_error, :CUSTOMER_NOT_FOUND],
      [:customer_error, :CUSTOMER_NOT_ENABLED],
    ].freeze

    # Returns true if the given error contains at least one terminal error code.
    # Safe to call with any error type — returns false for non-GoogleAdsError objects.
    def self.terminal?(error)
      return false unless error.is_a?(Google::Ads::GoogleAds::Errors::GoogleAdsError)
      return false unless error.respond_to?(:failure) && error.failure.respond_to?(:errors)

      error.failure.errors.any? do |individual_error|
        next false unless individual_error.respond_to?(:error_code)

        code_hash = individual_error.error_code.to_h
        code_hash.any? do |name, value|
          next false if value == :UNSPECIFIED
          TERMINAL_CODES.include?([name.to_sym, value.to_sym])
        end
      rescue
        false
      end
    rescue
      false
    end
  end
end
