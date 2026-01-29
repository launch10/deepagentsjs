class Subscriptions::CancelsController < ApplicationController
  before_action :authenticate_user!
  before_action :require_current_account_admin
  before_action :set_subscription

  def show
  end

  def destroy
    Rails.logger.info "[CancelSubscription] Canceling subscription #{@subscription.id} (#{@subscription.processor_id})"

    # Metered subscriptions should end immediately so they don't rack up more charges
    if @subscription.metered?
      @subscription.cancel_now!(invoice_now: true)

    # Unpaid subscriptions are treated as canceled, so end them immediately
    elsif @subscription.unpaid? || @subscription.past_due?
      @subscription.cancel_now!

    else
      # Cancel at period end
      @subscription.cancel
    end

    Rails.logger.info "[CancelSubscription] Successfully canceled. New status: #{@subscription.reload.status}"

    respond_to do |format|
      format.html { redirect_to subscriptions_path, status: :see_other }
      format.json { render json: { status: @subscription.status }, status: :ok }
    end
  rescue Pay::Error => e
    Rails.logger.error "[CancelSubscription] Pay::Error: #{e.message}"
    respond_to do |format|
      format.html do
        flash[:alert] = e.message
        render :show, status: :unprocessable_entity
      end
      format.json { render json: { error: e.message }, status: :unprocessable_entity }
    end
  end

  private

  def set_subscription
    @subscription = current_account.subscriptions.find_by_prefix_id!(params[:subscription_id])
    Rails.logger.info "[CancelSubscription] Found subscription: #{@subscription.id}, status: #{@subscription.status}"
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn "[CancelSubscription] Subscription not found: #{params[:subscription_id]}"
    respond_to do |format|
      format.html { redirect_to subscriptions_path }
      format.json { render json: { error: "Subscription not found" }, status: :not_found }
    end
  end
end
