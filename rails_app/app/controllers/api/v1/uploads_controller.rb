class API::V1::UploadsController < API::BaseController
  def index
    @uploads = policy_scope(Upload).order(id: :desc)

    if params[:website_id].present?
      website = current_account.websites.find_by(id: params[:website_id])
      return render json: { errors: ["Website not found"] }, status: :not_found unless website

      @uploads = website.uploads.order(id: :desc)
    end

    # Filter by specific IDs if provided
    if params[:ids].present?
      ids = Array(params[:ids]).map(&:to_i)
      @uploads = @uploads.where(id: ids)
    end

    # Filter by is_logo if specified
    if params[:is_logo].present?
      @uploads = @uploads.where(is_logo: params[:is_logo])
    end

    render json: @uploads.map(&:to_json)
  end

  def create
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
    # Skip file removal to avoid errors if file doesn't exist on storage
    upload.remove_file = false
    upload.destroy!

    # Try to remove file separately, ignoring errors if file doesn't exist
    begin
      upload.file.remove! if upload.file.present?
    rescue StandardError => e
      Rails.logger.warn "[Upload] Could not remove file for upload #{upload.id}: #{e.message}"
    end
  end

  def upload_params
    params.require(:upload).permit(:file, :is_logo, :website_id)
  end
end
