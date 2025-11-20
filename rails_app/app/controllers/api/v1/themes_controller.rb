class API::V1::ThemesController < API::BaseController
  def index
    @themes = policy_scope(Theme)
    render json: @themes.as_json(only: [:id, :name, :colors], include: {theme_labels: {only: [:id, :name]}})
  end
end
