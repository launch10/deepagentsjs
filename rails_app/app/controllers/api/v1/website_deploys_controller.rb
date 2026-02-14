class API::V1::WebsiteDeploysController < API::BaseController
  DEPLOYS_PER_PAGE = 5

  def index
    website = find_website

    scope = website.deploys
      .where(is_preview: false)
      .order(created_at: :desc)

    @pagy, @deploys = pagy(scope, limit: DEPLOYS_PER_PAGE)

    render json: {
      website_deploys: @deploys.map { |wd| website_deploy_props(wd) },
      pagination: pagy_metadata(@pagy)
    }
  end

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

  def find_website
    Website.joins(:project)
      .where(projects: {account_id: current_account.id})
      .find(params[:website_id])
  end

  def find_website_deploy
    WebsiteDeploy.joins(website: :project)
      .where(projects: {account_id: current_account.id})
      .find(params[:id])
  end

  def website_deploy_props(wd)
    {
      id: wd.id,
      status: wd.status,
      environment: wd.environment,
      is_live: wd.is_live,
      revertible: wd.revertible,
      created_at: wd.created_at
    }
  end

  def pagy_metadata(pagy)
    {
      current_page: pagy.page,
      total_pages: pagy.pages,
      total_count: pagy.count,
      prev_page: pagy.prev,
      next_page: pagy.next,
      from: pagy.from,
      to: pagy.to,
      series: pagy.series
    }
  end
end
