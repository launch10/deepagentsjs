# Helper methods for managing subscriptions in tests
module SubscriptionHelpers
  def create_subscribed_user(plan_name: "growth_monthly")
    user = create(:user)
    account = user.owned_account || create(:account, owner: user)

    # Subscribe the account using Pay gem's fake processor
    subscribe_account(account, plan_name: plan_name)

    user
  end

  def create_unsubscribed_user
    user = create(:user)
    user.owned_account || create(:account, owner: user)
    user
  end

  def subscribe_user(user, plan_name: "growth_monthly", processor: :fake_processor)
    account = user.owned_account || create(:account, owner: user)
    subscribe_account(account, plan_name: plan_name, processor: processor)
  end

  def subscribe_account(account, plan_name: "growth_monthly", processor: :fake_processor)
    if account.plan.present?
      return account.reload if account.plan.name == plan_name
      unsubscribe_account(account) # Unsubscribe from existing plan before subscribing to new plan
    end

    # Set up payment processor
    account.set_payment_processor processor, allow_fake: true
    account.save!

    # Find or create the plan
    plan = Plan.find_by(name: plan_name) || create(:plan, name: plan_name.to_sym, currency: 'usd')
    if plan.send("#{processor}_id").blank?
      plan.update!("#{processor}_id" => plan_name, :currency => 'usd') # or stripe_id, etc.
    end

    # Subscribe to the plan
    account.payment_processor.subscribe(
      name: Pay.default_product_name,
      plan: plan.send("#{processor}_id"),
      ends_at: nil
    )

    account.reload
  end

  def unsubscribe_account(account)
    if account.payment_processor&.subscribed?
      # For fake processor, we need to cancel immediately
      account.payment_processor.subscription.cancel_now!
    end
    account
  end

  def ensure_subscribed(user, plan_name: "growth_monthly")
    account = user.owned_account || create(:account, owner: user)
    subscribe_account(account, plan_name: plan_name) unless account.payment_processor&.subscribed?
    account
  end
end

RSpec.configure do |config|
  config.include SubscriptionHelpers
end
