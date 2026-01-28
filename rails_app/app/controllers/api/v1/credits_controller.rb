# frozen_string_literal: true

# Endpoint for Langgraph to check account credit balance.
#
# This endpoint is called before graph execution to determine if the
# account has sufficient credits to proceed. Uses JWT authentication
# to identify the account (same as other API endpoints).
#
class API::V1::CreditsController < API::BaseController
  # GET /api/v1/credits/check
  #
  # Returns the account's credit balance and whether they can proceed.
  #
  # @return [200 OK] Balance information with ok flag
  # @return [401 Unauthorized] When JWT is missing or invalid
  #
  def check
    render json: {
      ok: current_account.total_millicredits > 0,
      balance_millicredits: current_account.total_millicredits,
      plan_millicredits: current_account.plan_millicredits,
      pack_millicredits: current_account.pack_millicredits
    }
  end
end
