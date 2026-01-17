class API::V1::ChatsController < API::BaseController
  # POST /api/v1/chats/validate
  # Validates if a thread_id is valid for the current account
  # Returns valid: true if thread doesn't exist OR belongs to current account
  def validate
    thread_id = params[:thread_id]

    unless thread_id.present?
      render json: {errors: ["Thread ID is required"]}, status: :unprocessable_content and return
    end

    # Use unscoped to check across all accounts (bypass acts_as_tenant)
    chat = Chat.unscoped.find_by(thread_id: thread_id)

    if chat.nil?
      # Thread doesn't exist - valid for new thread creation
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

  # POST /api/v1/chats
  # Creates a new chat record for thread ownership
  def create
    unless params[:chat].present?
      render json: {errors: ["Chat params are required"]}, status: :unprocessable_content and return
    end

    unless chat_params[:thread_id].present?
      render json: {errors: ["Thread ID is required"]}, status: :unprocessable_content and return
    end

    unless chat_params[:chat_type].present?
      render json: {errors: ["Chat type is required"]}, status: :unprocessable_content and return
    end

    unless chat_params[:project_id].present?
      render json: {errors: ["Project ID is required"]}, status: :unprocessable_content and return
    end

    unless chat_params[:contextable_type].present?
      render json: {errors: ["Contextable type is required"]}, status: :unprocessable_content and return
    end

    unless chat_params[:contextable_id].present?
      render json: {errors: ["Contextable ID is required"]}, status: :unprocessable_content and return
    end

    # Verify project belongs to current account
    project = current_account.projects.find_by(id: chat_params[:project_id])
    unless project
      render json: {errors: ["Project not found"]}, status: :not_found and return
    end

    # Verify contextable exists and belongs to the project/account
    contextable = find_and_validate_contextable(project, chat_params[:contextable_type], chat_params[:contextable_id])
    unless contextable
      render json: {errors: ["Contextable not found or does not belong to project"]}, status: :not_found and return
    end

    # Check if chat already exists for this thread (unscoped to check all accounts)
    existing_chat = Chat.unscoped.find_by(thread_id: chat_params[:thread_id])
    if existing_chat
      if existing_chat.account_id == current_account.id
        # Already exists for this account - return it
        render json: chat_response(existing_chat), status: :ok and return
      else
        # Exists for different account - forbidden
        render json: {errors: ["Thread already exists for another account"]}, status: :forbidden and return
      end
    end

    chat = Chat.new(
      thread_id: chat_params[:thread_id],
      chat_type: chat_params[:chat_type],
      project_id: project.id,
      account_id: current_account.id,
      name: chat_params[:name] || project.name,
      contextable: contextable
    )

    if chat.save
      render json: chat_response(chat), status: :created
    else
      render json: {errors: chat.errors.full_messages}, status: :unprocessable_entity
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
