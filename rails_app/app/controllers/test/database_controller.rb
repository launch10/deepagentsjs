class Test::DatabaseController < Test::TestController
  SNAPSHOT_DIR = Rails.root.join("test/fixtures/database/snapshots")

  before_action :ensure_snapshots_directory_exists

  def truncate
    actually_truncate
    puts "Database truncated"
    render json: { status: "ok", message: "Database truncated" }, status: :ok
  end

  def create_snapshot
    begin
      name = params.require(:name)
      output_path = SNAPSHOT_DIR.join("#{name}.sql")
      result = Database::Snapshotter.new.dump(output_path)
    rescue => e
      render json: { status: 'error', message: "Failed to create snapshot: #{e.message}" }, status: :unprocessable_content and return
    end

    if result.success?
      render json: { status: 'ok', message: "Snapshot '#{name}' created." }, status: :created
    else
      render json: { status: 'error', message: "Failed to create snapshot: #{result.stderr}" }, status: :unprocessable_content
    end
  end

  def restore_snapshot
    begin
      name = params.require(:name)
      truncate_first = params[:truncate_first] == "true" || params[:truncate_first] == true
      input_path = SNAPSHOT_DIR.join("#{name}.sql")

      if truncate_first
        actually_truncate
      end
      result = Database::Snapshotter.new.restore(input_path)
    rescue => e
      puts "error restoring snapshot"
      render json: { status: 'error', message: "Failed to restore snapshot: #{e.message}" }, status: :unprocessable_content and return
    end

    if result.success?
      puts "Database restored"
      render json: { status: 'ok', message: "Snapshot '#{name}' restored." }, status: :ok
    else
      puts "Wtf"
      render json: { status: 'error', message: "Failed to restore snapshot: #{result.stderr}" }, status: :unprocessable_content
    end
  end

private

  def ensure_snapshots_directory_exists
    SNAPSHOT_DIR.mkpath unless SNAPSHOT_DIR.exist?
  end

  def actually_truncate
    Database::Snapshotter.new.truncate
  end
end
