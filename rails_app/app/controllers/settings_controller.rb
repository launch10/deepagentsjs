class SettingsController < SubscribedController
  def show
    @subscription = current_account.active_subscription
    @plan = @subscription&.plan

    render inertia: "Settings",
      props: settings_props,
      layout: "layouts/webcontainer"
  end

  def update
    if current_user.update(user_params)
      redirect_to settings_path, notice: "Profile updated successfully"
    else
      redirect_to settings_path, alert: current_user.errors.full_messages.join(", ")
    end
  end

  private

  def user_params
    params.require(:user).permit(:first_name, :last_name)
  end

  def settings_props
    {
      user: user_props,
      subscription: subscription_props,
      billing_history: billing_history_props,
      stripe_portal_url: stripe_portal_url,
      credit_packs: credit_packs_props
    }
  end

  def user_props
    {
      id: current_user.id,
      email: current_user.email,
      name: current_user.name,
      first_name: current_user.first_name,
      last_name: current_user.last_name
    }
  end

  def subscription_props
    return nil unless @subscription && @plan

    {
      id: @subscription.id,
      status: @subscription.status,
      plan_name: @plan.name,
      plan_display_name: @plan.display_name || @plan.name.titleize,
      interval: @plan.interval,
      amount_cents: @plan.amount,
      currency: @plan.currency,
      current_period_start: @subscription.current_period_start&.iso8601,
      current_period_end: @subscription.current_period_end&.iso8601,
      features: @plan.features || []
    }
  end

  def billing_history_props
    return nil unless current_account.payment_processor

    current_account.payment_processor.charges.order(created_at: :desc).limit(10).map do |charge|
      {
        id: charge.processor_id,
        amount_cents: charge.amount,
        currency: charge.currency || "usd",
        description: charge_description(charge),
        created_at: charge.created_at.iso8601,
        type: (charge.amount_refunded.to_i > 0) ? "refund" : "charge"
      }
    end
  end

  def charge_description(charge)
    return "Payment" unless charge.subscription_id

    subscription = current_account.subscriptions.find_by(id: charge.subscription_id)
    plan = subscription&.plan
    plan_name = plan&.display_name || plan&.name&.titleize || "Plan"
    interval = (plan&.interval == "year") ? "Yearly" : "Monthly"
    "#{plan_name} Plan - #{interval}"
  end

  def stripe_portal_url
    return nil unless current_account.payment_processor&.processor == "stripe"
    @stripe_portal_url ||= current_account.payment_processor.billing_portal(return_url: settings_url).url
  end

  def credit_packs_props
    CreditPack.visible.by_credits.map do |pack|
      {
        id: pack.id,
        name: pack.name,
        credits: pack.credits,
        price_cents: pack.price_cents,
        stripe_price_id: pack.stripe_price_id
      }
    end
  end
end
