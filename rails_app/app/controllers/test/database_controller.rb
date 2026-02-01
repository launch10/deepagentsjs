class Test::DatabaseController < Test::TestController
  SNAPSHOT_DIR = Rails.root.join("test/fixtures/database/snapshots")

  before_action :ensure_snapshots_directory_exists

  def truncate
    actually_truncate
    Rails.logger.info "[Test::DatabaseController] Database truncated"
    render json: {status: "ok", message: "Database truncated"}, status: :ok
  rescue => e
    render json: {
      status: "error",
      errors: ["Failed to truncate database: #{e.message}"]
    }, status: :internal_server_error
  end

  def index
    @snapshots = SNAPSHOT_DIR.children.map { |f| f.basename.to_s }.sort
    @snapshots = @snapshots.map { |s| s.gsub(Regexp.new("#{Pathname.new(s).extname}$"), "") }
    render json: {snapshots: @snapshots}, status: :ok
  end

  def create_snapshot
    begin
      params = snapshot_params
      output_path = SNAPSHOT_DIR.join("#{params[:name]}.sql")
      result = Database::Snapshotter.new.dump(output_path)
    rescue => e
      render json: {
        status: "error",
        errors: ["Failed to create snapshot: #{e.message}"]
      }, status: :unprocessable_content and return
    end

    if result.success?
      render json: {status: "ok", message: "Snapshot '#{params[:name]}' created."}, status: :created
    else
      render json: {
        status: "error",
        errors: ["Failed to create snapshot: #{result.stderr}"]
      }, status: :unprocessable_content
    end
  end

  def restore_snapshot
    begin
      params = snapshot_params
      truncate_first = params[:truncate_first] == "true" || params[:truncate_first] == true
      snapshot_name = params[:name]

      result = Database::Snapshotter.new.restore_snapshot(snapshot_name, truncate: truncate_first)
    rescue => e
      Rails.logger.error "[Test::DatabaseController] Error restoring snapshot: #{e.message} - #{e.respond_to?(:stderr) ? e.stderr : ""}"
      render json: {
        status: "error",
        errors: ["Failed to restore snapshot: #{e.message}"]
      }, status: :unprocessable_content and return
    end

    if result.success?
      Rails.logger.info "[Test::DatabaseController] Snapshot '#{snapshot_name}' restored"
      render json: {
        status: "ok",
        message: "Snapshot '#{snapshot_name}' restored."
      }, status: :ok
    else
      render json: {
        status: "error",
        errors: ["Failed to restore snapshot: #{result.stderr}"]
      }, status: :unprocessable_content
    end
  end

  def first_project
    project = Project.first
    if project
      render json: {
        status: "ok",
        project: {
          id: project.id,
          uuid: project.uuid,
          name: project.name
        }
      }, status: :ok
    else
      render json: {
        status: "error",
        errors: ["No project found"]
      }, status: :not_found
    end
  end

  def first_website
    website = Website.first
    if website
      render json: {
        status: "ok",
        website: {
          id: website.id,
          name: website.name,
          project_id: website.project_id
        }
      }, status: :ok
    else
      render json: {
        status: "error",
        errors: ["No website found"]
      }, status: :not_found
    end
  end

  # Sets stripe_price_id on a credit pack for e2e testing
  # Expects: { credit_pack: { id: number, stripe_price_id: string } }
  def set_credit_pack_stripe_price
    params_obj = credit_pack_params
    credit_pack = CreditPack.find_by(id: params_obj[:id])

    unless credit_pack
      render json: {
        status: "error",
        errors: ["Credit pack not found: #{params_obj[:id]}"]
      }, status: :not_found and return
    end

    credit_pack.update!(stripe_price_id: params_obj[:stripe_price_id])

    render json: {
      status: "ok",
      message: "Credit pack updated",
      credit_pack: {
        id: credit_pack.id,
        name: credit_pack.name,
        stripe_price_id: credit_pack.stripe_price_id
      }
    }, status: :ok
  rescue => e
    render json: {
      status: "error",
      errors: ["Failed to update credit pack: #{e.message}"]
    }, status: :unprocessable_content
  end

  # Sets credits for an account (for e2e testing credit exhaustion)
  # Expects: { credits: { email: string, plan_millicredits: number, pack_millicredits: number } }
  def set_credits
    params_obj = credits_params
    user = User.find_by(email: params_obj[:email])

    unless user
      render json: {
        status: "error",
        errors: ["User not found: #{params_obj[:email]}"]
      }, status: :not_found and return
    end

    account = user.owned_account
    unless account
      render json: {
        status: "error",
        errors: ["Account not found for user: #{params_obj[:email]}"]
      }, status: :not_found and return
    end

    plan = params_obj[:plan_millicredits] || 0
    pack = params_obj[:pack_millicredits] || 0

    # Use the proper AllocationService for credit adjustment
    admin = test_admin_user
    Credits::AllocationService.new(account).adjust_credits!(
      plan_millicredits: plan,
      pack_millicredits: pack,
      reason: "e2e_test_setup",
      admin: admin,
      notes: "Set via test endpoint",
      idempotency_key: "e2e_test:#{account.id}:#{Time.current.to_i}"
    )

    account.reload
    render json: {
      status: "ok",
      message: "Credits updated",
      account: {
        id: account.id,
        plan_millicredits: account.plan_millicredits,
        pack_millicredits: account.pack_millicredits,
        total_millicredits: account.total_millicredits
      }
    }, status: :ok
  rescue => e
    render json: {
      status: "error",
      errors: ["Failed to set credits: #{e.message}"]
    }, status: :unprocessable_content
  end

  # Creates platform subdomains to fill up the account's subdomain limit
  # Expects: { subdomains: { email: string } }
  # Returns: { subdomains_created: number, limit: number, used: number }
  def fill_subdomain_limit
    params_obj = subdomain_limit_params
    user = User.find_by(email: params_obj[:email])

    unless user
      render json: {
        status: "error",
        errors: ["User not found: #{params_obj[:email]}"]
      }, status: :not_found and return
    end

    account = user.owned_account
    unless account
      render json: {
        status: "error",
        errors: ["Account not found for user: #{params_obj[:email]}"]
      }, status: :not_found and return
    end

    limit = account.plan&.limit_for("platform_subdomains") || 0
    current_count = account.domains.platform_subdomains.count
    domains_to_create = limit - current_count

    created = 0
    domains_to_create.times do |i|
      domain_name = "test-subdomain-#{SecureRandom.hex(4)}.launch10.site"
      domain = account.domains.create!(
        domain: domain_name,
        is_platform_subdomain: true
      )
      created += 1 if domain.persisted?
    end

    render json: {
      status: "ok",
      message: "Subdomain limit filled",
      subdomains_created: created,
      limit: limit,
      used: account.domains.platform_subdomains.count
    }, status: :ok
  rescue => e
    render json: {
      status: "error",
      errors: ["Failed to fill subdomain limit: #{e.message}"]
    }, status: :unprocessable_content
  end

  # Assigns a custom domain to a website for e2e testing
  # Expects: { domain: { website_id: number, domain_name: string, path?: string } }
  # Note: email param is ignored - account is derived from the website
  # Returns: { domain: Domain, website_url: WebsiteUrl }
  def assign_custom_domain
    params_obj = custom_domain_params

    website = Website.find_by(id: params_obj[:website_id])
    unless website
      render json: {
        status: "error",
        errors: ["Website not found: #{params_obj[:website_id]}"]
      }, status: :not_found and return
    end

    # Derive account from website to ensure consistency
    account = website.account
    unless account
      render json: {
        status: "error",
        errors: ["Account not found for website: #{params_obj[:website_id]}"]
      }, status: :not_found and return
    end

    domain_name = params_obj[:domain_name] || "test-custom-#{SecureRandom.hex(4)}.example.com"
    path = params_obj[:path] || "/"

    # Create custom domain (not a platform subdomain)
    domain = account.domains.create!(
      domain: domain_name,
      is_platform_subdomain: false,
      dns_verification_status: "verified" # Mark as verified for testing
    )

    # Create website_url linking domain to website
    website_url = WebsiteUrl.create!(
      domain: domain,
      website: website,
      account: account,
      path: path
    )

    render json: {
      status: "ok",
      message: "Custom domain assigned to website",
      domain: {
        id: domain.id,
        domain: domain.domain,
        is_platform_subdomain: domain.is_platform_subdomain,
        dns_verification_status: domain.dns_verification_status
      },
      website_url: {
        id: website_url.id,
        domain_id: website_url.domain_id,
        website_id: website_url.website_id,
        path: website_url.path
      }
    }, status: :created
  rescue => e
    render json: {
      status: "error",
      errors: ["Failed to assign custom domain: #{e.message}"]
    }, status: :unprocessable_content
  end

  # Assigns a platform subdomain to a website for e2e testing
  # Expects: { subdomain: { website_id: number, subdomain: string, path?: string } }
  # Returns: { domain: Domain, website_url: WebsiteUrl }
  def assign_platform_subdomain
    params_obj = platform_subdomain_params

    website = Website.find_by(id: params_obj[:website_id])
    unless website
      render json: {
        status: "error",
        errors: ["Website not found: #{params_obj[:website_id]}"]
      }, status: :not_found and return
    end

    account = website.account
    unless account
      render json: {
        status: "error",
        errors: ["Account not found for website: #{params_obj[:website_id]}"]
      }, status: :not_found and return
    end

    subdomain = params_obj[:subdomain] || "test-site-#{SecureRandom.hex(4)}"
    domain_name = "#{subdomain}.launch10.site"
    path = params_obj[:path] || "/"

    # Create platform subdomain
    domain = account.domains.create!(
      domain: domain_name,
      is_platform_subdomain: true
    )

    # Create website_url linking domain to website
    website_url = WebsiteUrl.create!(
      domain: domain,
      website: website,
      account: account,
      path: path
    )

    render json: {
      status: "ok",
      message: "Platform subdomain assigned to website",
      domain: {
        id: domain.id,
        domain: domain.domain,
        subdomain: subdomain,
        is_platform_subdomain: domain.is_platform_subdomain
      },
      website_url: {
        id: website_url.id,
        domain_id: website_url.domain_id,
        website_id: website_url.website_id,
        path: website_url.path
      }
    }, status: :created
  rescue => e
    render json: {
      status: "error",
      errors: ["Failed to assign platform subdomain: #{e.message}"]
    }, status: :unprocessable_content
  end

  private

  def snapshot_params
    params.require(:snapshot).permit(:name, :truncate_first)
  end

  def credits_params
    params.require(:credits).permit(:email, :plan_millicredits, :pack_millicredits)
  end

  def credit_pack_params
    params.require(:credit_pack).permit(:id, :stripe_price_id)
  end

  def subdomain_limit_params
    params.require(:subdomains).permit(:email)
  end

  def custom_domain_params
    params.require(:domain).permit(:email, :website_id, :domain_name, :path)
  end

  def platform_subdomain_params
    params.require(:subdomain).permit(:website_id, :subdomain, :path)
  end

  def ensure_snapshots_directory_exists
    SNAPSHOT_DIR.mkpath unless SNAPSHOT_DIR.exist?
  end

  def actually_truncate
    Database::Snapshotter.new.truncate
  end

  # Find or create a test admin user for credit adjustments
  def test_admin_user
    User.find_by(admin: true) || User.find_by(email: "brett@launch10.ai") || create_test_admin
  end

  def create_test_admin
    User.create!(
      email: "test_admin@launch10.ai",
      password: "TestAdminPass123!",
      password_confirmation: "TestAdminPass123!",
      first_name: "Test",
      last_name: "Admin",
      terms_of_service: true,
      confirmed_at: Time.current,
      admin: true
    )
  end
end
