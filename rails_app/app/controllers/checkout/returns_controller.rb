class Checkout::ReturnsController < ApplicationController
  before_action :authenticate_user!
  before_action :require_current_account_admin

  def show
    object = Pay.sync(params)

    if object.is_a?(Pay::Charge)
      flash[:notice] = t(".success")
    elsif object.is_a?(Pay::Subscription) && object.active?
      flash[:notice] = t("subscriptions.created")
    else
      flash[:alert] = t("something_went_wrong")
    end

    redirect_to params.fetch(:return_to, new_project_path)
  end

  private

  # Force full page reload instead of Turbo visit.
  # The checkout page uses Turbo (via minimal layout), but the destination
  # (BrainstormLanding) is an Inertia page requiring different JavaScript.
  def redirect_to(url_or_options, response_options = {})
    response.set_header("Turbo-Visit-Control", "reload")
    super
  end
end
