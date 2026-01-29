# frozen_string_literal: true

class CreditPackCheckoutsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_credit_pack, only: [:show, :create]
  before_action :require_active_subscription, only: [:create]

  def show
    @client_secret = params[:client_secret]

    if @client_secret.blank?
      redirect_to settings_path, alert: "Missing checkout session"
      return
    end

    render layout: "application"
  end

  def create
    if @credit_pack.stripe_price_id.blank?
      return render json: { error: "Credit pack does not have a Stripe price configured" }, status: :unprocessable_entity
    end

    checkout_session = create_checkout_session
    render json: { client_secret: checkout_session.client_secret }
  end

  # Handle Stripe redirect after payment completion
  def complete
    Pay.sync(params)
    flash[:notice] = {
      title: "Credits purchased!",
      description: "Your credits have been added to your account."
    }.to_json
    redirect_to settings_path
  end

  private

  def create_checkout_session
    payment_processor = current_account.add_payment_processor(:stripe)

    payment_processor.checkout(
      mode: :payment,
      line_items: @credit_pack.stripe_price_id,
      return_url: complete_credit_pack_checkouts_url,
      ui_mode: :embedded,
      payment_intent_data: {
        metadata: {
          credit_pack_id: @credit_pack.id
        }
      }
    )
  end

  def set_credit_pack
    @credit_pack = CreditPack.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Credit pack not found" }, status: :not_found
  end

  def require_active_subscription
    return if current_account.subscriptions.active.exists?

    render json: { error: "Active subscription required to purchase credits" }, status: :forbidden
  end
end
