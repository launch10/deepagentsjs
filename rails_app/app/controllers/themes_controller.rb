class ThemesController < SubscribedController
  respond_to :json

  def index
    @themes = Theme.all.includes(:theme_labels)
    render json: @themes.as_json(include: :theme_labels)
  end
end
