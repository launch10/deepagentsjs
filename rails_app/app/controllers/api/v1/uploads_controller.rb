class API::V1::UploadsController < API::BaseController
  def index
    @uploads = policy_scope(Upload).order(id: :desc)

    if params[:website_id].present?
      website = current_account.websites.find_by(id: params[:website_id])
      return render json: { errors: ["Website not found"] }, status: :not_found unless website

      @uploads = website.uploads.order(id: :desc)
    end

    render json: @uploads.map(&:to_json)
  end

  def create
    begin
      result = Upload.create_upload!(current_account, upload_params)
      upload = result[:upload]
      render json: upload.to_json, status: :created
    rescue => e
      Rails.logger.error("Upload creation failed: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
      render json: { errors: e.message }, status: :unprocessable_entity
    end
  end

  private

  def upload_params
    params.require(:upload).permit(:file, :is_logo, :website_id)
  end
end
