module UtmTracking
  extend ActiveSupport::Concern

  UTM_COOKIE = :signup_attribution
  UTM_PARAMS = %w[utm_source utm_medium utm_campaign utm_term utm_content gclid fbclid ref icp].freeze

  included do
    before_action :capture_utm_params
  end

  private

  def capture_utm_params
    return if cookies[UTM_COOKIE].present? # first-touch: don't overwrite

    attribution = {}

    UTM_PARAMS.each do |key|
      attribution[key] = params[key] if params[key].present?
    end

    attribution["landing_page"] = request.original_url if attribution.any?

    # Prefer referrer forwarded from landing page (original referrer) over HTTP Referer header
    referrer = params[:referrer].presence || request.referer.presence
    if referrer.present?
      attribution["referrer"] = referrer
      attribution["referring_domain"] = params[:referring_domain].presence || (URI.parse(referrer).host rescue nil)
    end

    return if attribution.except("referrer", "referring_domain").empty? # don't set cookie for just a referrer with no UTMs

    cookies[UTM_COOKIE] = {
      value: attribution.to_json,
      expires: 30.days.from_now,
      httponly: true,
      secure: Rails.env.production?
    }
  end

  def signup_attribution
    return nil unless cookies[UTM_COOKIE].present?
    JSON.parse(cookies[UTM_COOKIE])
  rescue JSON::ParserError
    nil
  end

  def clear_signup_attribution_cookie
    cookies.delete(UTM_COOKIE)
  end
end
