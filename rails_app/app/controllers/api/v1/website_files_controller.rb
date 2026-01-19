class API::V1::WebsiteFilesController < API::BaseController
  def edit
    website = current_account.websites.find_by(id: params[:website_id])
    unless website
      render json: {errors: ["Website not found"]}, status: :not_found and return
    end

    path = params[:path]
    old_string = params[:old_string]
    new_string = params[:new_string]
    replace_all = params[:replace_all] == true || params[:replace_all] == "true"

    unless path.present? && old_string.present? && new_string.present?
      render json: {errors: ["path, old_string, and new_string are required"]}, status: :unprocessable_entity and return
    end

    normalized_path = path.gsub(/^\//, "")
    website_file = website.website_files.find_by(path: normalized_path)

    # If not found in website_files, check template_files and create a website_file from it
    unless website_file
      template_file = website.template_files.find_by(path: normalized_path)
      unless template_file
        render json: {errors: ["File not found: #{normalized_path}"]}, status: :not_found and return
      end

      # Create website_file from template_file content
      website_file = website.website_files.create!(path: normalized_path, content: template_file.content)
    end

    content = website_file.content
    occurrences = content.scan(old_string).length

    if occurrences == 0
      render json: {errors: ["String not found in file: '#{old_string}'"]}, status: :unprocessable_entity and return
    end

    if occurrences > 1 && !replace_all
      render json: {
        errors: ["String '#{old_string}' appears #{occurrences} times in file. Use replace_all=true to replace all instances, or provide a more specific string with surrounding context."]
      }, status: :unprocessable_entity and return
    end

    new_content = content.gsub(old_string, new_string)

    if website_file.update(content: new_content)
      render json: {
        file: serialize_file(website_file),
        occurrences: occurrences
      }, status: :ok
    else
      render json: {errors: website_file.errors.full_messages}, status: :unprocessable_entity
    end
  end

  def write
    website = current_account.websites.find_by(id: params[:website_id])
    unless website
      render json: {errors: ["Website not found"]}, status: :not_found and return
    end

    files_params = params.require(:files)
    unless files_params.is_a?(Array)
      render json: {errors: ["files must be an array"]}, status: :unprocessable_entity and return
    end

    # Validate all files have required fields before processing
    invalid_file = files_params.find { |f| !f[:path].present? || !f[:content].present? }
    if invalid_file
      render json: {errors: ["Each file must have path and content"]}, status: :unprocessable_entity and return
    end

    website_files_attributes = files_params.map do |file_param|
      path = file_param[:path]
      content = file_param[:content]
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
