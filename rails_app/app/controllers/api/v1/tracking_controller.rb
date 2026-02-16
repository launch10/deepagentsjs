# Public endpoint for tracking visits and events from landing pages.
# Uses project signup_token for stateless, tamper-proof authentication.
# DOES NOT inherit from API::BaseController - this is a public endpoint.
class API::V1::TrackingController < ActionController::API
  # POST /api/v1/tracking/visit
  # Creates or updates a visit for analytics tracking
  # Must be synchronous - client needs visit_token immediately
  def visit
    project = Project.find_signed!(params[:token], purpose: :lead_signup)
    website = project.website

    unless website
      render json: { error: "Website not found" }, status: :not_found
      return
    end

    visit_record = find_or_create_visit(website)

    render json: { success: true, visit_token: visit_record.visit_token }, status: :ok
  rescue ActiveSupport::MessageVerifier::InvalidSignature, ActiveRecord::RecordNotFound
    render json: { error: "Invalid token" }, status: :unauthorized
  end

  # POST /api/v1/tracking/event
  # Creates an event linked to a visit (processed async)
  def event
    project = Project.find_signed!(params[:token], purpose: :lead_signup)
    website = project.website

    unless website
      render json: { error: "Website not found" }, status: :not_found
      return
    end

    visit_record = Ahoy::Visit.find_by(
      visit_token: params[:visit_token],
      website_id: website.id
    )

    unless visit_record
      render json: { error: "Visit not found" }, status: :not_found
      return
    end

    # Validate time format synchronously
    event_time = nil
    if params[:time].present?
      begin
        event_time = Time.parse(params[:time]).iso8601
      rescue ArgumentError => e
        render json: { error: e.message }, status: :unprocessable_entity
        return
      end
    end

    # Enqueue background worker for event creation
    # In test environment, Sidekiq::Testing.inline! runs jobs immediately
    Tracking::EventWorker.perform_async(
      visit_record.id,
      params[:name],
      params[:properties]&.to_unsafe_h || {},
      event_time
    )

    render json: { success: true }, status: :accepted
  rescue ActiveSupport::MessageVerifier::InvalidSignature, ActiveRecord::RecordNotFound
    render json: { error: "Invalid token" }, status: :unauthorized
  end

  private

  def find_or_create_visit(website)
    # Try to find existing visit by visit_token
    if params[:visit_token].present?
      existing = Ahoy::Visit.find_by(
        visit_token: params[:visit_token],
        website_id: website.id
      )
      return existing if existing
    end

    # Create new visit
    Ahoy::Visit.create!(
      website_id: website.id,
      visitor_token: params[:visitor_token],
      visit_token: params[:visit_token] || SecureRandom.uuid,
      referrer: params[:referrer],
      landing_page: params[:landing_page],
      utm_source: params[:utm_source],
      utm_medium: params[:utm_medium],
      utm_campaign: params[:utm_campaign],
      utm_content: params[:utm_content],
      utm_term: params[:utm_term],
      gclid: params[:gclid],
      fbclid: params[:fbclid],
      user_agent: request.user_agent,
      ip: request.remote_ip,
      started_at: Time.current
    )
  end
end
