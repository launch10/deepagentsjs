class Subscriptions::ResumesController < ApplicationController
  before_action :authenticate_user!
  before_action :require_current_account_admin
  before_action :set_subscription

  def show
  end

  def create
    perform_resume
  end

  def update
    perform_resume
  end

  private

  def perform_resume
    Rails.logger.info "[ResumeSubscription] Resuming subscription #{@subscription.id}"

    @subscription.resume

    Rails.logger.info "[ResumeSubscription] Successfully resumed. New status: #{@subscription.reload.status}"

    respond_to do |format|
      format.html { redirect_to subscriptions_path }
      format.json { render json: { status: @subscription.status }, status: :ok }
    end
  rescue Pay::Error => e
    Rails.logger.error "[ResumeSubscription] Pay::Error: #{e.message}"
    respond_to do |format|
      format.html do
        flash[:alert] = e.message
        render :show, status: :unprocessable_entity
      end
      format.json { render json: { error: e.message }, status: :unprocessable_entity }
    end
  end

  def set_subscription
    @subscription = current_account.subscriptions.find_by_prefix_id!(params[:subscription_id])
  rescue ActiveRecord::RecordNotFound
    respond_to do |format|
      format.html { redirect_to subscriptions_path }
      format.json { render json: { error: "Subscription not found" }, status: :not_found }
    end
  end
end
