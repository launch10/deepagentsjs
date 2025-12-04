class API::V1::WebsiteFilesController < API::BaseController
  def write
    website = current_account.websites.find_by(thread_id: params[:thread_id])
    unless website
      render json: {errors: ["Website not found"]}, status: :not_found and return
    end

    files_params = params.require(:files)
    unless files_params.is_a?(Array)
      render json: {errors: ["files must be an array"]}, status: :unprocessable_entity and return
    end

    website_files_attributes = files_params.map do |file_param|
      path = file_param[:path]
      content = file_param[:content]

      unless path.present? && content.present?
        render json: {errors: ["Each file must have path and content"]}, status: :unprocessable_entity and return
      end

      normalized_path = path.gsub(/^\//, "")
      existing_file = website.website_files.find_by(path: normalized_path)

      if existing_file
        {id: existing_file.id, path: normalized_path, content: content}
      else
        {path: normalized_path, content: content}
      end
    end

    if website.update(website_files_attributes: website_files_attributes)
      render json: {
        files: website.website_files.reload.map { |f| serialize_file(f) }
      }, status: :ok
    else
      render json: {errors: website.errors.full_messages}, status: :unprocessable_entity
    end
  end

  private

  def serialize_file(file)
    {
      id: file.id,
      website_id: file.website_id,
      path: file.path,
      content: file.content,
      created_at: file.created_at,
      updated_at: file.updated_at
    }
  end
end
