class Test::DeploysController < Test::TestController
  before_action :authenticate_user!

  # DELETE /test/deploys/:deploy_id/restart
  # Resets the deploy to pending and deletes its chat + langgraph checkpoints.
  # Chat will be re-created by the graph's initDeploy node on next run.
  def restart
    deploy = Deploy.find(params[:deploy_id])
    chat = deploy.chat

    if chat
      thread_id = chat.thread_id

      # Delete langgraph checkpoints via the langgraph service
      begin
        LanggraphClient.new.delete("/api/deploy/thread/#{thread_id}")
      rescue => e
        Rails.logger.warn("[restart_deploy] Failed to delete langgraph checkpoints: #{e.message}")
      end

      # Hard-delete the chat so the graph creates a fresh one
      chat.really_destroy!
    end

    # Reset deploy to pending — graph will create chat on next run
    deploy.update!(status: "pending", current_step: nil, is_live: false, stacktrace: nil)

    render json: {success: true}
  end
end
