# frozen_string_literal: true

# Internal service endpoint for Langgraph to check account credit balance.
#
# This endpoint is called before graph execution to determine if the
# account has sufficient credits to proceed. Uses internal service auth
# (signature verification without JWT).
#
class API::V1::CreditsController < API::BaseController
  skip_before_action :require_api_authentication, only: [:check]
  before_action :verify_internal_service_call, only: [:check]

  # GET /api/v1/credits/check
  #
  # Returns the account's credit balance and whether they can proceed.
  #
  # @param account_id [Integer] The account to check
  # @return [200 OK] Balance information with ok flag
  # @return [400 Bad Request] When account_id is missing
  # @return [404 Not Found] When account doesn't exist
  #
  def check
    account_id = params[:account_id]

    if account_id.blank?
      return render json: { error: "account_id is required" }, status: :bad_request
    end

    account = Account.find_by(id: account_id)

    if account.nil?
      return render json: { error: "Account not found" }, status: :not_found
    end

    render json: {
      ok: account.total_millicredits > 0,
      balance_millicredits: account.total_millicredits,
      plan_millicredits: account.plan_millicredits,
      pack_millicredits: account.pack_millicredits
    }
  end
end
