class Test::ChatsController < Test::TestController
  before_action :authenticate_user!

  # DELETE /test/websites/:website_id/restart_chat
  # Deletes the chat and langgraph checkpoints to restart from scratch.
  def restart_chat
    website = current_account.websites.find(params[:website_id])
    chat = website.chat

    unless chat
      render json: {error: "No chat to restart"}, status: :not_found and return
    end

    thread_id = chat.thread_id

    # Delete langgraph checkpoints via the langgraph service
    begin
      LanggraphClient.new.delete("/api/website/thread/#{thread_id}")
    rescue => e
      Rails.logger.warn("[restart_chat] Failed to delete langgraph checkpoints: #{e.message}")
    end

    # Hard-delete the chat (bypass soft delete since we want a clean slate)
    chat.really_destroy!

    # Also delete website_files so the create flow triggers fresh
    website.website_files.each(&:really_destroy!)

    render json: {success: true}
  end
end
