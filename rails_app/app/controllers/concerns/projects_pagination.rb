# frozen_string_literal: true

# Shared pagination logic for projects listing.
# Used by both ProjectsController (Inertia SSR) and API::V1::ProjectsController.
module ProjectsPagination
  extend ActiveSupport::Concern

  PROJECTS_PER_PAGE = 5

  private

  def paginated_projects(scope = current_account.projects)
    pagy(
      scope.includes(website: :website_url).order(updated_at: :desc),
      limit: PROJECTS_PER_PAGE
    )
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

  def status_counts
    current_account.projects.group(:status).count
  end
end
