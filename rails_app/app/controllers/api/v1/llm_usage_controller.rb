# frozen_string_literal: true

# Internal service endpoint for Langgraph to notify Rails about LLM usage.
#
# This endpoint triggers the credit charging pipeline after a run completes.
# It's called by Langgraph's notifyRails function using internal service auth
# (signature verification without JWT).
#
class API::V1::LLMUsageController < API::BaseController
  skip_before_action :require_api_authentication, only: [:notify]
  before_action :verify_internal_service_call, only: [:notify]

  # POST /api/v1/llm_usage/notify
  #
  # Triggers the credit charging worker for a completed run.
  #
  # @param run_id [String] The LLM run ID to process
  # @return [202 Accepted] When job is enqueued
  # @return [422 Unprocessable Entity] When run_id is missing
  #
  def notify
    run_id = params[:run_id]

    if run_id.blank?
      return render json: { error: "run_id is required" }, status: :unprocessable_entity
    end

    Credits::ChargeRunWorker.perform_async(run_id)
    head :accepted
  end
end
