class API::V1::UploadsController < API::BaseController
  def index
    @uploads = policy_scope(Upload).order(id: :desc)

    if params[:website_id].present?
      website = current_account.websites.find_by(id: params[:website_id])
      return render json: { errors: ["Website not found"] }, status: :not_found unless website

      @uploads = website.uploads.order(id: :desc)
    end

    # Filter by UUID if provided
    @uploads = @uploads.where(uuid: params[:uuid]) if params[:uuid].present?

    # Filter by filename (the CarrierWave file column, e.g. "d419572e-...jpg")
    @uploads = @uploads.where(file: params[:filename]) if params[:filename].present?

    # Filter by specific IDs if provided
    # Rails receives array params as ids[] from query string
    ids_param = params[:ids]
    if ids_param.present?
      ids = Array(ids_param).map(&:to_i)
      @uploads = @uploads.where(id: ids)
    end

    # Filter by is_logo if specified
    if params[:is_logo].present?
      @uploads = @uploads.where(is_logo: params[:is_logo])
    end

    # Apply sorting - order=recent sorts by created_at desc
    @uploads = @uploads.reorder(created_at: :desc) if params[:order] == "recent"

    # Apply limit if specified
    @uploads = @uploads.limit(params[:limit].to_i) if params[:limit].present?

    render json: @uploads.map(&:to_json)
  end

  def create
    authorize Upload
    result = Upload.create_upload!(current_account, upload_params)
    upload = result[:upload]
    render json: upload.to_json, status: :created
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.error "[Upload Error] #{e.class}: #{e.message}"
    render json: { errors: "invalid upload" }, status: :unprocessable_entity
  rescue => e
    Rails.logger.error "[Upload Error] #{e.class}: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    render json: { errors: "invalid upload" }, status: :unprocessable_entity
  end

  def update
    @upload = policy_scope(Upload).find(params[:id])
    authorize @upload

    Upload.transaction do
      @upload.update!(upload_update_params)

      if params.dig(:upload, :website_id).present?
        website = current_account.websites.find_by!(id: params[:upload][:website_id])
        WebsiteUpload.find_or_create_by!(website: website, upload: @upload)
      end
    end

    render json: @upload.reload.to_json
  rescue ActiveRecord::RecordNotFound
    render json: { errors: ["Upload not found"] }, status: :not_found
  rescue => e
    render json: { errors: [e.message] }, status: :unprocessable_entity
  end

  def destroy
    @upload = policy_scope(Upload).find(params[:id])
    authorize @upload
    destroy_upload(@upload)
    head :no_content
  rescue ActiveRecord::RecordNotFound
    render json: { errors: ["Upload not found"] }, status: :not_found
  end

  private

  def destroy_upload(upload)
    upload.destroy!
  rescue Aws::S3::Errors::NotFound => e
    # File already gone from storage - record is deleted, this is fine
    Rails.logger.warn "[Upload] File not found on storage during destroy: #{e.message}"
  end

  def upload_params
    params.require(:upload).permit(:file, :is_logo, :website_id)
  end

  def upload_update_params
    params.require(:upload).permit(:is_logo)
  end
end
