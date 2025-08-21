# Helper methods for managing subscriptions in tests
module SubscriptionHelpers
  def create_subscribed_user(plan_name: 'pro')
    user = create(:user)
    account = user.owned_account || create(:account, owner: user)
    
    # Subscribe the account using Pay gem's fake processor
    subscribe_account(account, plan_name: plan_name)
    
    user
  end

  def create_unsubscribed_user
    user = create(:user)
    account = user.owned_account || create(:account, owner: user)
    user
  end

  def subscribe_account(account, plan_name: 'pro')
    # Set up payment processor
    account.set_payment_processor :fake_processor, allow_fake: true
    
    # Find or create the plan
    plan = Plan.find_by(name: plan_name) || create(:plan, name: plan_name.to_sym)
    
    # Subscribe to the plan
    account.payment_processor.subscribe(
      plan: plan.fake_processor_id || plan.name,
      ends_at: nil
    )
    
    account
  end

  def unsubscribe_account(account)
    if account.payment_processor&.subscribed?
      # For fake processor, we need to cancel immediately
      account.payment_processor.subscription.cancel_now!
    end
    account
  end

  def ensure_subscribed(user, plan_name: 'pro')
    account = user.owned_account || create(:account, owner: user)
    subscribe_account(account, plan_name: plan_name) unless account.payment_processor&.subscribed?
    account
  end
end