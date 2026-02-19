# frozen_string_literal: true

class API::V1::CreditPackCheckoutsController < API::BaseController
  before_action :set_credit_pack
  before_action :require_active_subscription

  # POST /api/v1/credit_packs/:credit_pack_id/checkout
  def create
    if @credit_pack.stripe_price_id.blank?
      return render json: { error: "Credit pack does not have a Stripe price configured" }, status: :unprocessable_entity
    end

    checkout_session = create_checkout_session
    render json: { client_secret: checkout_session.client_secret }
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
    @credit_pack = CreditPack.find(params[:credit_pack_id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Credit pack not found" }, status: :not_found
  end

  def require_active_subscription
    return if current_account.subscriptions.active.exists?

    render json: { error: "Active subscription required to purchase credits" }, status: :forbidden
  end
end
