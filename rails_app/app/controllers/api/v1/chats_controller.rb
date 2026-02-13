class API::V1::ChatsController < API::BaseController
  # POST /api/v1/chats/validate
  # Validates if a thread_id is valid for the current account.
  #
  # Security: If chat exists, it must belong to current account.
  # If chat doesn't exist yet, the user is authenticated (JWT validated
  # by BaseController) so they're allowed — chat gets created during
  # graph execution (e.g. updateWebsite, createBrainstorm nodes).
  def validate
    thread_id = params[:thread_id]

    unless thread_id.present?
      render json: {errors: ["Thread ID is required"]}, status: :unprocessable_content and return
    end

    # Use unscoped to check across all accounts (bypass acts_as_tenant)
    chat = Chat.unscoped.find_by(thread_id: thread_id)

    if chat.nil?
      # Thread doesn't exist yet — user is authenticated, allow creation
      render json: {valid: true, exists: false, chat_type: nil, project_id: nil}
    elsif chat.account_id == current_account.id
      # Thread exists and belongs to current account - valid
      render json: {
        valid: true,
        exists: true,
        chat_type: chat.chat_type,
        project_id: chat.project_id
      }
    else
      # Thread exists but belongs to a different account - invalid
      render json: {valid: false, exists: true, chat_type: nil, project_id: nil}, status: :forbidden
    end
  end

  private

  def chat_params
    params.require(:chat).permit(:thread_id, :chat_type, :project_id, :name, :contextable_type, :contextable_id)
  end

  def chat_response(chat)
    {
      id: chat.id,
      thread_id: chat.thread_id,
      chat_type: chat.chat_type,
      project_id: chat.project_id,
      account_id: chat.account_id,
      name: chat.name,
      created_at: chat.created_at,
      updated_at: chat.updated_at
    }
  end

  def find_and_validate_contextable(project, contextable_type, contextable_id)
    case contextable_type
    when "Brainstorm"
      project.brainstorm if project.brainstorm&.id == contextable_id.to_i
    when "Website"
      project.website if project.website&.id == contextable_id.to_i
    when "Campaign"
      project.campaigns.find_by(id: contextable_id)
    when "Deploy"
      project.deploys.find_by(id: contextable_id)
    end
  end
end
