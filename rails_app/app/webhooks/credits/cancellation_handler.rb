# frozen_string_literal: true

module Credits
  # Handles customer.subscription.deleted webhooks for subscription cancellations.
  #
  # When a subscription ends (either at period end or immediately), Stripe fires
  # this event. We intentionally do NOT expire plan credits here — the user has
  # already paid for the current period and retains their remaining balance.
  #
  # Protection against new credit grants is handled elsewhere:
  # - RenewalHandler skips inactive subscriptions (no new monthly allocations)
  # - DailyReconciliationWorker excludes subscriptions with ends_at set
  #   (no monthly resets for yearly subscribers pending cancellation)
  #
  # Usage:
  #   Pay::Webhooks.delegator.subscribe "stripe.customer.subscription.deleted", Credits::CancellationHandler.new
  #
  class CancellationHandler
    def call(event)
      # No-op for credits. The subscription is ending, but we don't expire
      # plan credits. The user keeps their remaining balance.
      #
      # New credit grants are prevented by:
      # 1. RenewalHandler checks subscription.active? (canceled subs are skipped)
      # 2. DailyReconciliationWorker excludes subs with ends_at set

      subscription = Pay::Subscription
        .joins(:customer)
        .find_by(pay_customers: {processor: "stripe"}, processor_id: event.data.object.id)
      return unless subscription

      account = subscription.customer&.owner
      return unless account.is_a?(Account)

      plan = Plan.find_by(stripe_id: subscription.processor_plan)
      user = account.owner
      TrackEvent.call("subscription_cancelled",
        user: user,
        account: account,
        plan_name: plan&.name,
        months_subscribed: subscription.created_at ? ((Time.current - subscription.created_at) / 1.month).round : nil,
        projects_live: account.projects.where(status: "live").count,
        last_active_days_ago: user&.updated_at ? ((Time.current - user.updated_at) / 1.day).round : nil
      )
    end
  end
end
