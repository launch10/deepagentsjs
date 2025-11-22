class Test::DatabaseController < Test::TestController
  SNAPSHOT_DIR = Rails.root.join("test/fixtures/database/snapshots")

  before_action :ensure_snapshots_directory_exists

  def truncate
    actually_truncate
    puts "Database truncated"
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
      input_path = SNAPSHOT_DIR.join("#{params[:name]}.sql")

      if truncate_first
        actually_truncate
      end
      result = Database::Snapshotter.new.restore(input_path)
    rescue => e
      puts "error restoring snapshot"
      render json: {
        status: "error",
        errors: ["Failed to restore snapshot: #{e.message}"]
      }, status: :unprocessable_content and return
    end

    if result.success?
      puts "Database restored"
      render json: {
        status: "ok",
        message: "Snapshot '#{params[:name]}' restored."
      }, status: :ok
    else
      render json: {
        status: "error",
        errors: ["Failed to restore snapshot: #{result.stderr}"]
      }, status: :unprocessable_content
    end
  end

  private

  def snapshot_params
    params.require(:snapshot).permit(:name, :truncate_first)
  end

  def ensure_snapshots_directory_exists
    SNAPSHOT_DIR.mkpath unless SNAPSHOT_DIR.exist?
  end

  def actually_truncate
    Database::Snapshotter.new.truncate
  end
end
