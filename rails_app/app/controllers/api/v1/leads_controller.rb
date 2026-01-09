# Public endpoint for landing pages to submit email signups.
# Uses Rails signed_id for stateless, tamper-proof authentication.
# DOES NOT inherit from API::BaseController - this is a public endpoint.
class API::V1::LeadsController < ActionController::API
  def create
    project = Project.find_signed!(params[:token], purpose: :lead_signup)

    normalized_email = Lead.normalize_email(lead_params[:email])

    # Already captured - acknowledge and move on
    return render json: { success: true }, status: :ok if project.leads.exists?(email: normalized_email)

    lead = project.leads.new(lead_params)
    if lead.save
      render json: { success: true }, status: :created
    else
      render json: { errors: lead.errors }, status: :unprocessable_entity
    end
  rescue ActiveSupport::MessageVerifier::InvalidSignature, ActiveRecord::RecordNotFound
    render json: { error: "Invalid token" }, status: :unauthorized
  end

  private

  def lead_params
    params.permit(:email, :name)
  end
end
