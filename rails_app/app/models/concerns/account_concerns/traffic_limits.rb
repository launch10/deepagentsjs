module AccountConcerns
  module TrafficLimits
    extend ActiveSupport::Concern

    def monthly_request_limit
      plan&.monthly_request_limit || 0
    end
    alias_method :usage_limit, :monthly_request_limit

    def request_count
      account_request_counts.current_month.sum(&:request_count)
    end

    def over_monthly_request_limit?
      request_count > monthly_request_limit
    end

    def under_monthly_request_limit?
      !over_monthly_request_limit?
    end
  end
end