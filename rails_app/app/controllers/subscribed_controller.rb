class SubscribedController < ApplicationController
  include Webcontainer
  before_action :refresh_jwt, if: proc { !request.format.json? && jwt_expired? }
  before_action :sign_in_jwt, if: proc { !user_signed_in? && jwt_user.present? }
  before_action :require_subscription!, unless: -> { Plan.none? }

  def root_path
    request.base_url
  end

  def langgraph_path
    Langgraph.url
  end

  inertia_share do
    flash_messages = []

    flash_messages << {type: "success", message: flash[:notice]} if flash[:notice]

    flash_messages << {type: "error", message: flash[:error]} if flash[:error]

    flash_messages << {type: "info", message: flash[:info]} if flash[:info]

    {
      root_path: root_path,
      langgraph_path: langgraph_path,
      jwt: cookies[:jwt],
      errors: session.delete(:errors) || {},
      flash: flash_messages,
      current_user: current_user&.slice(:id, :name, :email),
      true_user: true_user&.slice(:id, :name, :email),
      impersonating: current_user && true_user && current_user.id != true_user.id,
      credits: credits_data
    }
  end

  private

  def credits_data
    return nil unless current_account

    {
      plan_credits: Millicredits.to_credits(current_account.plan_millicredits),
      pack_credits: Millicredits.to_credits(current_account.pack_millicredits),
      total_credits: Millicredits.to_credits(current_account.total_millicredits),
      plan_credits_allocated: plan_credits_allocated,
      period_ends_at: current_account.subscriptions.active.order(id: :desc).first&.current_period_end&.iso8601
    }
  end

  def plan_credits_allocated
    plan = current_account.plan
    return 0 unless plan&.plan_tier

    plan.plan_tier.credits
  end

  def sign_in_jwt
    sign_in(jwt_user, store: false)
  end

  def credit_balance_shared_props
    return nil unless current_account

    subscription = current_account.active_subscription
    plan = subscription&.plan

    {
      plan_credits: current_account.plan_credits,
      pack_credits: current_account.pack_credits,
      total_credits: current_account.total_credits,
      plan_credit_limit: plan&.credits || 0,
      reset_date: subscription&.current_period_end&.strftime("%b %d, %Y")
    }
  end
end
