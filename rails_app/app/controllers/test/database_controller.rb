# Database snapshot operations for e2e tests.
#
# This controller handles only database-level operations:
# - Truncation
# - Snapshot creation/restoration
# - Listing snapshots
#
# For test data scenarios (creating records, setting credits, etc.),
# use cypress-on-rails app_commands in e2e/app_commands/scenarios/.
#
# @see e2e/support/on-rails.ts for TypeScript client
# @see e2e/app_commands/scenarios/ for available scenarios
class Test::DatabaseController < Test::TestController
  SNAPSHOT_DIR = Rails.root.join("test/fixtures/database/snapshots")

  before_action :ensure_snapshots_directory_exists

  # POST /test/database/truncate
  def truncate
    Database::Snapshotter.new.truncate
    Rails.logger.info "[Test::DatabaseController] Database truncated"
    render json: {status: "ok", message: "Database truncated"}, status: :ok
  rescue => e
    render json: {
      status: "error",
      errors: ["Failed to truncate database: #{e.message}"]
    }, status: :internal_server_error
  end

  # GET /test/database/snapshots
  def index
    @snapshots = SNAPSHOT_DIR.children.map { |f| f.basename.to_s }.sort
    @snapshots = @snapshots.map { |s| s.gsub(Regexp.new("#{Pathname.new(s).extname}$"), "") }
    render json: {snapshots: @snapshots}, status: :ok
  end

  # POST /test/database/snapshots
  def create_snapshot
    output_path = SNAPSHOT_DIR.join("#{snapshot_params[:name]}.sql")
    result = Database::Snapshotter.new.dump(output_path)

    if result.success?
      render json: {status: "ok", message: "Snapshot '#{snapshot_params[:name]}' created."}, status: :created
    else
      render json: {
        status: "error",
        errors: ["Failed to create snapshot: #{result.stderr}"]
      }, status: :unprocessable_content
    end
  rescue => e
    render json: {
      status: "error",
      errors: ["Failed to create snapshot: #{e.message}"]
    }, status: :unprocessable_content
  end

  # POST /test/database/restore_snapshot
  def restore_snapshot
    truncate_first = snapshot_params[:truncate_first] == "true" || snapshot_params[:truncate_first] == true
    snapshot_name = snapshot_params[:name]

    result = Database::Snapshotter.new.restore_snapshot(snapshot_name, truncate: truncate_first)

    if result.success?
      Rails.logger.info "[Test::DatabaseController] Snapshot '#{snapshot_name}' restored"
      render json: {status: "ok", message: "Snapshot '#{snapshot_name}' restored."}, status: :ok
    else
      render json: {
        status: "error",
        errors: ["Failed to restore snapshot: #{result.stderr}"]
      }, status: :unprocessable_content
    end
  rescue => e
    Rails.logger.error "[Test::DatabaseController] Error restoring snapshot: #{e.message}"
    render json: {
      status: "error",
      errors: ["Failed to restore snapshot: #{e.message}"]
    }, status: :unprocessable_content
  end

  # GET /test/database/first_project
  # Kept for backward compatibility - returns first project from snapshot
  def first_project
    project = Project.first
    if project
      render json: {
        status: "ok",
        project: {id: project.id, uuid: project.uuid, name: project.name}
      }, status: :ok
    else
      render json: {status: "error", errors: ["No project found"]}, status: :not_found
    end
  end

  # GET /test/database/first_website
  # Kept for backward compatibility - returns first website from snapshot
  def first_website
    website = Website.first
    if website
      render json: {
        status: "ok",
        website: {id: website.id, name: website.name, project_id: website.project_id}
      }, status: :ok
    else
      render json: {status: "error", errors: ["No website found"]}, status: :not_found
    end
  end

  private

  def snapshot_params
    params.require(:snapshot).permit(:name, :truncate_first)
  end

  def ensure_snapshots_directory_exists
    SNAPSHOT_DIR.mkpath unless SNAPSHOT_DIR.exist?
  end
end
