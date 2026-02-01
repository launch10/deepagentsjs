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

  def domain_context
    website = current_account.websites.find_by(id: params[:website_id])

    unless website
      render json: {errors: ["Website not found"]}, status: :not_found and return
    end

    domains = current_account.domains.includes(:website, :website_urls)

    # Get the website's assigned URL (source of truth)
    assigned_url = website.website_urls.includes(:domain).first

    render json: {
      existing_domains: domains.map { |domain| serialize_domain(domain) },
      assigned_url: assigned_url ? serialize_website_url(assigned_url) : nil,
      platform_subdomain_credits: platform_subdomain_credits,
      brainstorm_context: serialize_brainstorm(website.brainstorm),
      plan_tier: current_account.plan&.plan_tier&.name
    }
  end

  private

  def serialize_domain(domain)
    {
      id: domain.id,
      domain: domain.domain,
      is_platform_subdomain: domain.is_platform_subdomain,
      website_id: domain.website_id,
      website_name: domain.website&.name,
      website_urls: domain.website_urls.map do |url|
        {
          id: url.id,
          path: url.path,
          website_id: url.website_id
        }
      end,
      dns_verification_status: domain.dns_verification_status,
      created_at: domain.created_at.iso8601
    }
  end

  def platform_subdomain_credits
    limit = current_account.plan&.limit_for("platform_subdomains") || 0
    used = current_account.domains.platform_subdomains.count

    {
      limit: limit,
      used: used,
      remaining: [limit - used, 0].max
    }
  end

  def serialize_brainstorm(brainstorm)
    return nil unless brainstorm

    {
      id: brainstorm.id,
      idea: brainstorm.idea,
      audience: brainstorm.audience,
      solution: brainstorm.solution,
      social_proof: brainstorm.social_proof
    }
  end

  def serialize_website_url(website_url)
    domain = website_url.domain
    {
      id: website_url.id,
      path: website_url.path,
      domain_id: domain.id,
      domain: domain.domain,
      is_platform_subdomain: domain.is_platform_subdomain,
      dns_verification_status: domain.dns_verification_status,
      full_url: website_url.full_url
    }
  end
end
