class API::V1::ThemesController < API::BaseController
  def index
    @themes = policy_scope(Theme).order(id: :asc)
    render json: @themes.as_json(only: [:id, :name, :colors], include: {theme_labels: {only: [:id, :name]}})
  end

  def show
    @theme = policy_scope(Theme).find(params[:id])
    render json: @theme.as_json(
      only: [:id, :name, :colors, :theme, :pairings, :typography_recommendations],
      include: {theme_labels: {only: [:id, :name]}}
    )
  end

  def create
    @theme = Theme.new(themes_params)
    @theme.author = current_account
    if @theme.save
      render json: @theme.as_json(only: [:id, :name, :colors], include: {theme_labels: {only: [:id, :name]}})
    else
      render json: {errors: @theme.errors}, status: :unprocessable_entity
    end
  end

  private

  def themes_params
    params.require(:theme).permit(:name, colors: [])
  end
end
