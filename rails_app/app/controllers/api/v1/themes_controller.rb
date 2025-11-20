class API::V1::ThemesController < API::BaseController
  def index
    @themes = Theme.all.includes(:theme_labels)
    render json: @themes.as_json(only: [:id, :name, :colors], include: {theme_labels: {only: [:id, :name]}})
  end
end
