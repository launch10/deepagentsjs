class WebsitesController < SubscribedController
  def create
    website = current_account.websites.new(website_params)
    website.account_id = current_account.id

    if website.save
      render json: website_json(website), status: :created
    else
      render json: {errors: website.errors.full_messages}, status: :unprocessable_entity
    end
  end

  def update
    website = current_account.websites.find(params[:id])
    website.update(website_params)
    render json: to_mini_json(website)
  end

  private

  def website_params
    params.require(:website).permit(
      :name,
      :thread_id,
      :project_id,
      website_files_attributes: [:path, :content, :file_specification_id]
    )
  end

  def to_mini_json(website)
    {
      id: website.id,
      name: website.name,
      thread_id: website.thread_id,
      project_id: website.project_id,
      created_at: website.created_at,
      updated_at: website.updated_at
    }
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
          path: file.path,
          content: file.content,
          file_specification_id: file.file_specification_id,
          source: file.source
        }
      end
    }
  end
end
