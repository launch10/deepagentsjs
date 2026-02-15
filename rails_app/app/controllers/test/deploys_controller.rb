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
end
