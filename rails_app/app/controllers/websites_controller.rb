class WebsitesController < SubscribedController
  def create
    website = Website.new(website_params)
    website.user_id = current_user.id
    
    if website.save
      render json: website_json(website), status: :created
    else
      render json: { errors: website.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def website_params
    params.require(:website).permit(:name, :thread_id, :project_id, 
      files_attributes: [:path, :content])
  end

  def website_json(website)
    {
      id: website.id,
      name: website.name,
      thread_id: website.thread_id,
      project_id: website.project_id,
      created_at: website.created_at,
      updated_at: website.updated_at,
      files: website.files.map do |file|
        {
          id: file.id,
          path: file.path,
          content: file.content
        }
      end
    }
  end
end