# frozen_string_literal: true

# Adapts Pay::FakeProcessor::Subscription to behave like a real payment processor
# for development and testing. The FakeProcessor's cancel/resume methods are no-ops,
# so we override them to actually update the subscription state.
module FakeProcessorSubscriptionAdapter
  extend ActiveSupport::Concern

  included do
    # Wrap cancel to set ends_at for FakeProcessor
    def cancel(**options)
      result = super

      if fake_processor? && ends_at.nil?
        update!(ends_at: current_period_end)
      end

      result
    end

    # Wrap cancel_now! to set ends_at and status for FakeProcessor
    def cancel_now!(**options)
      result = super

      if fake_processor?
        update!(ends_at: Time.current, status: "canceled")
      end

      result
    end

    # Wrap resume to clear ends_at for FakeProcessor
    def resume(**options)
      result = super

      if fake_processor? && ends_at.present?
        update!(ends_at: nil)
      end

      result
    end

    private

    def fake_processor?
      type == "Pay::FakeProcessor::Subscription"
    end
  end
end
