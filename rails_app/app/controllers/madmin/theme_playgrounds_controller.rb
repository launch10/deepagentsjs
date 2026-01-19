# Inherits from SubscribedController to get Inertia sharing (jwt, root_path, etc.)
# Skips subscription requirement since this is an admin-only page.
class Madmin::ThemePlaygroundsController < SubscribedController
  skip_before_action :require_subscription!
  before_action :authenticate_admin_user

  def show
    @themes = Theme.order(:id).includes(:theme_labels)

    render inertia: "admin/ThemePlayground",
      props: {
        themes: @themes.as_json(
          only: [:id, :name, :colors, :theme, :pairings, :theme_type],
          include: { theme_labels: { only: [:id, :name] } }
        )
      },
      layout: "layouts/webcontainer"
  end

  private

  def authenticate_admin_user
    redirect_to main_app.root_path, alert: "Not authorized" unless current_user&.admin?
  end
end
