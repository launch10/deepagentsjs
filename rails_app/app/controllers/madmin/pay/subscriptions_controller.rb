module Madmin
  class Pay::SubscriptionsController < Madmin::ResourceController
    def index
      @subscriptions = ::Pay::Subscription.includes(:customer).order(created_at: :desc).limit(100)

      render inertia: "Madmin/Pay/Subscriptions/Index",
        props: {
          subscriptions: @subscriptions.map { |s| serialize_subscription(s) }
        }
    end

    def show
      @subscription = ::Pay::Subscription.find(params[:id])

      render inertia: "Madmin/Pay/Subscriptions/Show",
        props: {
          subscription: serialize_subscription(@subscription, detailed: true)
        }
    end

    private

    def serialize_subscription(subscription, detailed: false)
      data = {
        id: subscription.id,
        name: subscription.name,
        status: subscription.status,
        processorId: subscription.processor_id,
        processorPlan: subscription.processor_plan,
        quantity: subscription.quantity,
        customerName: subscription.customer&.owner&.name,
        customerEmail: subscription.customer&.email,
        createdAt: subscription.created_at&.iso8601
      }

      if detailed
        data.merge!(
          trialEndsAt: subscription.trial_ends_at&.iso8601,
          endsAt: subscription.ends_at&.iso8601,
          currentPeriodStart: subscription.current_period_start&.iso8601,
          currentPeriodEnd: subscription.current_period_end&.iso8601,
          metered: subscription.metered?,
          stripeAccount: subscription.stripe_account,
          metadata: subscription.metadata,
          updatedAt: subscription.updated_at&.iso8601
        )
      end

      data
    end
  end
end
