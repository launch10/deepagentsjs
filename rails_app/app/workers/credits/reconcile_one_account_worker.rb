# frozen_string_literal: true

module Credits
  class ReconcileOneAccountWorker < ApplicationWorker
    def perform(account_id)
      account = Account.find(account_id)
      subscription = account.payment_processor&.subscription

      return unless subscription&.active?
      return unless subscription.plan&.yearly?

      Credits::ResetPlanCreditsWorker.new.perform(subscription.id)
    end
  end
end
