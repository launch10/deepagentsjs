class Api::V1::BrainstormsController < Api::BaseController
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
    current_account.brainstorms.find_by(thread_id: params[:thread_id])
  end

  def brainstorm_params
    params.require(:brainstorm).permit(:name, :thread_id, :account_id)
  end

  def update_params
    params.require(:brainstorm).permit(:name, :idea, :audience, :solution, :social_proof, :look_and_feel)
  end
end
