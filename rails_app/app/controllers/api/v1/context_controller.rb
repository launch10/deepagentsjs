class API::V1::ContextController < API::BaseController
  def show
    website = current_account.websites.find_by(id: params[:website_id])

    unless website
      render json: {errors: ["Website not found"]}, status: :not_found and return
    end

    render json: {
      brainstorm: website.brainstorm&.to_json,
      uploads: website.uploads.map(&:to_json),
      theme: website.theme&.as_json(
        only: [:id, :name, :colors, :typography_recommendations]
      )
    }
  end
end
