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
    total = plan + pack

    # Create adjust transaction with sequence validation bypassed (test-only)
    tx = account.credit_transactions.new(
      transaction_type: "adjust",
      credit_type: "plan",
      reason: "e2e_test_setup",
      amount_millicredits: total - account.total_millicredits,
      balance_after_millicredits: total,
      plan_balance_after_millicredits: plan,
      pack_balance_after_millicredits: pack,
      idempotency_key: "e2e_test:#{account.id}:#{Time.current.to_i}"
    )
    tx.skip_sequence_validation = true
    tx.save!

    # update_account_balances callback handles the account update

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

  def ensure_snapshots_directory_exists
    SNAPSHOT_DIR.mkpath unless SNAPSHOT_DIR.exist?
  end

  def actually_truncate
    Database::Snapshotter.new.truncate
  end
end
