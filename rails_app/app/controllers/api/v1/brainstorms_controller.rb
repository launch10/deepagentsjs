class API::V1::BrainstormsController < API::BaseController
  def show
    brainstorm = current_brainstorm

    unless brainstorm
      render json: {errors: ["Not found"]}, status: :not_found and return
    end

    render json: brainstorm.to_mini_json
  end

  def create
    unless brainstorm_params[:thread_id].present?
      render json: {errors: ["Thread ID is required"]}, status: :unprocessable_entity and return
    end
    unless brainstorm_params.dig(:project_attributes, :uuid).present?
      render json: {errors: ["Project UUID is required"]}, status: :unprocessable_entity and return
    end

    begin
      values = Brainstorm.create_brainstorm!(current_account, brainstorm_params)
      brainstorm = values[:brainstorm]
    rescue => e
      if e.respond_to?(:record) && e.record.errors.any?
        render json: {errors: e.record.errors.full_messages}, status: :unprocessable_entity and return
      end
      render json: {errors: ["Something went wrong"]}, status: :unprocessable_entity and return
    end

    render json: brainstorm.to_mini_json, status: :created
  end

  def update
    brainstorm = current_brainstorm

    unless brainstorm
      render json: {errors: ["Brainstorm not found"]}, status: :not_found and return
    end

    begin
      Brainstorm.update_brainstorm!(brainstorm, update_params)
    rescue => e
      render json: {errors: e.record&.errors&.full_messages || [e.message]}, status: :unprocessable_entity and return
    end

    render json: brainstorm.to_mini_json
  end

  private

  def current_brainstorm
    current_account.brainstorms.joins(:chat).find_by(chats: { thread_id: params[:thread_id] })
  end

  def brainstorm_params
    params.require(:brainstorm).permit(:name, :account_id, :thread_id, project_attributes: [:uuid])
  end

  def update_params
    params.require(:brainstorm).permit(:name, :idea, :audience, :solution, :social_proof, :look_and_feel)
  end
end
