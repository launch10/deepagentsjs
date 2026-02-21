# Public endpoint for landing pages to submit email signups.
# Uses Rails signed_id for stateless, tamper-proof authentication.
# DOES NOT inherit from API::BaseController - this is a public endpoint.
class API::V1::LeadsController < ActionController::API
  def create
    project = Project.find_signed!(params[:token], purpose: :lead_signup)
    website = project.website
    account = project.account

    unless website
      render json: { error: "Website not found" }, status: :not_found
      return
    end

    # Validate email format synchronously - users need immediate feedback
    # Skip uniqueness check since we want idempotent behavior (accept existing emails)
    email = Lead.normalize_email(lead_params[:email])
    validation_lead = Lead.new(account: account, email: email, name: lead_params[:name], phone: lead_params[:phone])
    validation_lead.validate
    # Only report format/presence errors, not uniqueness (that's handled by the worker)
    format_errors = validation_lead.errors.reject { |e| e.type == :taken }
    if format_errors.any?
      errors = ActiveModel::Errors.new(validation_lead)
      format_errors.each { |e| errors.add(e.attribute, e.type, message: e.message) }
      render json: { errors: errors }, status: :unprocessable_entity
      return
    end

    # Find the visit if visitor/visit tokens are provided (sync - need the ID)
    visit = find_or_create_visit(website)

    # Enqueue background worker for lead processing
    Leads::ProcessWorker.perform_async(
      account.id,
      website.id,
      {
        email: email,
        name: lead_params[:name],
        phone: lead_params[:phone],
        visit_id: visit&.id,
        visitor_token: params[:visitor_token],
        gclid: params[:gclid],
        fbclid: params[:fbclid],
        conversion_value: params[:conversion_value]&.to_f,
        conversion_currency: params[:conversion_currency],
        utm_source: params[:utm_source],
        utm_medium: params[:utm_medium],
        utm_campaign: params[:utm_campaign],
        utm_content: params[:utm_content],
        utm_term: params[:utm_term]
      }.compact
    )

    # Return immediately - processing happens in background
    render json: { success: true }, status: :accepted
  rescue ActiveSupport::MessageVerifier::InvalidSignature, ActiveRecord::RecordNotFound
    render json: { error: "Invalid token" }, status: :unauthorized
  end

  private

  def lead_params
    params.permit(:email, :name, :phone)
  end

  def find_or_create_visit(website)
    return nil unless params[:visit_token].present?

    # Find existing visit
    visit = Ahoy::Visit.find_by(
      visit_token: params[:visit_token],
      website_id: website.id
    )

    return visit if visit

    # Create visit if we have enough info
    return nil unless params[:visitor_token].present?

    Ahoy::Visit.create!(
      website_id: website.id,
      visitor_token: params[:visitor_token],
      visit_token: params[:visit_token],
      gclid: params[:gclid],
      fbclid: params[:fbclid],
      user_agent: request.user_agent,
      ip: request.remote_ip,
      started_at: Time.current
    )
  end
end
