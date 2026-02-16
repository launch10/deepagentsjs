class Test::DeploysController < Test::TestController
  before_action :authenticate_user!

  # DELETE /test/deploys/:deploy_id/restart
  # Deletes the deploy and its langgraph checkpoints.
  # On page reload, find_existing_deploy returns nil → useDeployInit auto-starts
  # → Langgraph creates a fresh deploy via initDeployNode.
  def restart
    deploy = Deploy.find(params[:deploy_id])

    begin
      LanggraphClient.new.delete("/api/deploy/thread/#{deploy.thread_id}")
    rescue => e
      Rails.logger.warn("[restart_deploy] Failed to delete langgraph checkpoints: #{e.message}")
    end

    deploy.destroy!

    render json: {success: true}
  end

  # DELETE /test/deploys/:deploy_id/full_reset
  # Nuclear reset: clears deploy + Google Ads + OAuth + campaign sync state.
  # On page reload, useDeployInit auto-starts fresh deploy from ConnectingGoogle.
  def full_reset
    deploy = Deploy.find(params[:deploy_id])
    Deploys::FullResetService.new(deploy).call
    render json: {success: true}
  end
end
