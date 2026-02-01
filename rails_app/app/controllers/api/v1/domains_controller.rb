class API::V1::DomainsController < API::BaseController
  MAX_CANDIDATES = 10

  def search
    candidates = params[:candidates]

    if candidates.blank? || !candidates.is_a?(Array)
      render json: {errors: ["candidates parameter is required and must be an array"]}, status: :unprocessable_entity
      return
    end

    if candidates.length > MAX_CANDIDATES
      render json: {errors: ["Maximum #{MAX_CANDIDATES} candidates allowed"]}, status: :unprocessable_entity
      return
    end

    normalized_candidates = candidates.map { |c| normalize_domain(c) }.compact

    # Check global uniqueness using unscoped query
    existing_domains = Domain.unscoped.where(domain: normalized_candidates).index_by(&:domain)

    results = normalized_candidates.map do |domain_string|
      existing_domain = existing_domains[domain_string]

      if existing_domain.nil?
        {domain: domain_string, status: "available", existing_id: nil}
      elsif existing_domain.account_id == current_account.id
        {domain: domain_string, status: "existing", existing_id: existing_domain.id}
      else
        {domain: domain_string, status: "unavailable", existing_id: nil}
      end
    end

    render json: {
      results: results,
      platform_subdomain_credits: platform_subdomain_credits
    }
  end

  def index
    domains = current_account.domains.includes(:website, :website_urls)
    domains = domains.where(website_id: params[:website_id]) if params[:website_id].present?

    include_urls = ActiveModel::Type::Boolean.new.cast(params[:include_website_urls])

    render json: {
      domains: domains.map { |d| d.to_api_json(include_website_urls: include_urls) },
      platform_subdomain_credits: platform_subdomain_credits,
      plan_tier: current_account.plan&.plan_tier&.name
    }
  end

  def show
    domain = current_account.domains.find_by(id: params[:id])

    unless domain
      render json: {errors: ["Not found"]}, status: :not_found and return
    end

    render json: domain.to_api_json
  end

  # Unified endpoint for claiming a domain + path for a website.
  # Handles all cases:
  # 1. New domain (creates Domain + WebsiteUrl)
  # 2. Existing domain owned by account (finds Domain, creates WebsiteUrl)
  # 3. Existing domain owned by another account (returns error)
  # 4. Out of credits for new platform subdomain (returns error)
  #
  # IMPORTANT: A website can only have ONE domain at a time. When assigning a new
  # domain, any existing domains for that website are unlinked (website_id set to nil)
  # but kept in the account for potential reassignment.
  def create
    website_id = domain_params[:website_id]

    # Validate website belongs to current account
    website = current_account.websites.find_by(id: website_id)
    unless website
      render json: {errors: ["Website not found"]}, status: :unprocessable_entity and return
    end
    domain_string = domain_params[:domain]
    path = domain_params[:path] || "/"

    # Check if domain already exists (globally)
    existing_domain = Domain.unscoped.find_by(domain: domain_string)

    if existing_domain
      if existing_domain.account_id == current_account.id
        # User already owns this domain - just create the WebsiteUrl
        domain = existing_domain
      else
        # Domain belongs to another account
        render json: {errors: ["This domain is not available"]}, status: :unprocessable_entity and return
      end
    else
      # Create new domain
      domain = current_account.domains.build(
        domain: domain_string,
        website_id: website_id,
        is_platform_subdomain: domain_params[:is_platform_subdomain]
      )

      unless domain.save
        render json: {errors: domain.errors.full_messages}, status: :unprocessable_entity and return
      end
    end

    # Unassign old domains from this website (but keep them in the account)
    # 1. Clear website_id on old domains (so they don't appear in website.domains)
    # 2. Delete old website_urls (triggers Atlas sync to remove old URLs)
    old_domains = website.domains.where.not(id: domain.id)
    old_domains.find_each do |old_domain|
      old_domain.update!(website_id: nil)  # Unlink from website, keep domain
    end
    website.website_urls.where.not(domain_id: domain.id).destroy_all  # Delete old URLs

    # Create WebsiteUrl (domain + path + website combination)
    website_url = WebsiteUrl.find_or_initialize_by(
      domain_id: domain.id,
      path: path,
      account_id: current_account.id
    )
    website_url.website_id = website_id

    if website_url.save
      render json: {
        domain: domain.to_api_json,
        website_url: website_url.to_api_json,
        platform_subdomain_credits: platform_subdomain_credits
      }, status: :created
    else
      render json: {errors: website_url.errors.full_messages}, status: :unprocessable_entity
    end
  end

  def update
    domain = current_account.domains.find_by(id: params[:id])

    unless domain
      render json: {errors: ["Not found"]}, status: :not_found and return
    end

    # Validate website_id belongs to current account if present
    if params[:domain][:website_id].present?
      website = current_account.websites.find_by(id: params[:domain][:website_id])
      unless website
        render json: {errors: ["Website not found"]}, status: :unprocessable_entity and return
      end
    end

    if domain.update(update_params)
      render json: domain.to_api_json
    else
      render json: {errors: domain.errors.full_messages}, status: :unprocessable_entity
    end
  end

  def verify_dns
    domain = current_account.domains.find_by(id: params[:id])

    unless domain
      render json: {errors: ["Domain not found"]}, status: :not_found
      return
    end

    if domain.is_platform_subdomain
      render json: {
        domain_id: domain.id,
        domain: domain.domain,
        verification_status: "verified",
        expected_cname: nil,
        actual_cname: nil,
        last_checked_at: nil,
        error_message: nil
      }
      return
    end

    result = Domains::DnsVerificationService.new(domain).verify

    render json: {
      domain_id: domain.id,
      domain: domain.domain,
      verification_status: result[:status],
      expected_cname: Domains::DnsVerificationService::EXPECTED_CNAME,
      actual_cname: result[:actual_cname],
      last_checked_at: domain.reload.dns_last_checked_at&.iso8601,
      error_message: result[:error]
    }
  end

  private

  def domain_params
    params.require(:domain).permit(:domain, :website_id, :is_platform_subdomain, :path)
  end

  def update_params
    params.require(:domain).permit(:website_id)
  end

  def normalize_domain(domain_string)
    return nil if domain_string.blank?
    domain_string = domain_string.to_s.downcase.strip
    domain_string = domain_string.sub(/^https?:\/\//, "")
    domain_string.split("/").first
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
end
