class TemplatesController < SubscribedController
  respond_to :json

  def index
    @templates = Template.all
    render json: @templates
  end

  def show
    template = Template.find_by(name: params[:id])
    render json: {error: "Template not found"}, status: :not_found and return if template.nil?

    @template_files = template.files
    render "templates/show", formats: [:json]
  end
end
