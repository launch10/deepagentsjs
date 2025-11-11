class BrainstormsController < SubscribedController
  def show
    chat = Chat.find_by(thread_id: params[:thread_id])
    unless chat.chat_type === "brainstorm"
      render json: { errors: ["Not found"] }, status: :not_found and return
    end
    brainstorm = chat.contextable

    unless brainstorm
      render json: { errors: ["Brainstorm not found"] }, status: :not_found and return
    end

    respond_to do |format|
      format.html do
        render inertia: 'Brainstorm', props: {
          brainstorm: brainstorm,
        }, layout: "layouts/webcontainer"
      end
      format.json do
        render json: brainstorm.to_mini_json
      end
    end
  end

  def create
    # Validate thread_id is present
    unless brainstorm_params[:thread_id].present?
      render json: { errors: ["Thread ID is required"] }, status: :unprocessable_entity and return
    end

    begin
      values = Brainstorm.create_brainstorm!(current_account, brainstorm_params)
      brainstorm = values[:brainstorm]
    rescue => e
      render json: { errors: e.record&.errors&.full_messages || [e.message] }, status: :unprocessable_entity and return
    end

    render json: brainstorm.to_mini_json, status: :created
  end

  def update
    project = current_account.projects.find_by(id: params[:id])
    brainstorm = project&.website&.brainstorm

    unless brainstorm
      render json: { errors: ["Brainstorm not found"] }, status: :not_found and return
    end

    begin
      Brainstorm.update_brainstorm!(brainstorm, update_params)
    rescue => e
      render json: { errors: e.record&.errors&.full_messages || [e.message] }, status: :unprocessable_entity and return
    end

    render json: brainstorm.to_mini_json
  end

  def new
    respond_to do |format|
      format.html do
        render inertia: 'Brainstorm', props: {
        }, layout: "layouts/webcontainer"
      end
    end
  end

  def brainstorm_params
    params.require(:brainstorm).permit(:name, :thread_id, :account_id)
  end

  def update_params
    params.require(:brainstorm).permit(:name, :idea, :audience, :solution, :social_proof, :look_and_feel)
  end

  def creation_account
    @creation_account ||= begin
      if brainstorm_params[:account_id].present?
        account_id = brainstorm_params[:account_id]
        Account.find(account_id)
      else
        current_account
      end
    end
  end
end