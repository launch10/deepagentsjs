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
