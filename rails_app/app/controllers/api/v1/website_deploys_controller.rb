class API::V1::WebsiteDeploysController < API::BaseController
  def rollback
    website_deploy = find_website_deploy

    unless website_deploy.status == "completed"
      return render json: {errors: ["Cannot rollback non-completed deploy"]}, status: :unprocessable_entity
    end

    if website_deploy.is_preview?
      return render json: {errors: ["Cannot rollback preview deploys"]}, status: :unprocessable_entity
    end

    unless website_deploy.revertible?
      return render json: {errors: ["Cannot rollback non-revertible deploy"]}, status: :unprocessable_entity
    end

    if website_deploy.is_live?
      return render json: {errors: ["Cannot roll back any further!"]}, status: :unprocessable_entity
    end

    website_deploy.rollback(async: true)

    render json: {success: true}
  end

  private

  def find_website_deploy
    WebsiteDeploy.joins(website: :project)
      .where(projects: {account_id: current_account.id})
      .find(params[:id])
  end
end
