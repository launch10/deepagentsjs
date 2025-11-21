class API::V1::ProjectWorkflowsController < API::BaseController
  def update
    workflow = current_workflow

    unless workflow
      render json: {errors: ["Workflow not found"]}, status: :not_found and return
    end

    step = params.dig(:project_workflow, :step)
    substep = params.dig(:project_workflow, :substep)

    unless step.present?
      render json: {errors: ["Step is required"]}, status: :unprocessable_entity and return
    end

    unless workflow.advance_to(step: step, substep: substep)
      render json: {errors: ["Invalid step or substep"]}, status: :unprocessable_entity and return
    end

    render json: workflow.as_json
  end

  def next
    workflow = current_workflow

    unless workflow
      render json: {errors: ["Workflow not found"]}, status: :not_found and return
    end

    next_step, _ = workflow.next_step!
    unless next_step
      render json: {errors: ["Already at final step"]}, status: :unprocessable_entity and return
    end

    render json: workflow.as_json
  end

  private

  def current_workflow
    project = current_account.projects.find_by(uuid: params[:project_uuid])
    return nil unless project

    project.workflows.find_by(id: params[:id])
  end
end
