namespace :db do
  SNAPSHOT_DIR = Rails.root.join("test/fixtures/database/snapshots")

  desc "Truncate all tables in the test database (test environment only)"
  task truncate: :environment do
    unless Rails.env.test?
      puts "ERROR: This task can only be run in the test environment"
      puts "Current environment: #{Rails.env}"
      exit 1
    end

    require 'database_cleaner-active_record'
    DatabaseCleaner.clean_with(:truncation)
    puts "Database truncated successfully"
  end

  desc "Create a snapshot of the test database (test environment only)"
  task :snapshot, [:name] => :environment do |t, args|
    unless Rails.env.test?
      puts "ERROR: This task can only be run in the test environment"
      puts "Current environment: #{Rails.env}"
      exit 1
    end

    unless args[:name]
      puts "ERROR: Snapshot name is required"
      puts "Usage: rake db:test:snapshot[snapshot_name]"
      exit 1
    end

    ensure_snapshots_directory_exists
    
    output_path = SNAPSHOT_DIR.join("#{args[:name]}.sql")
    result = Database::Snapshotter.new.dump(output_path)

    if result.success?
      puts "Snapshot '#{args[:name]}' created successfully at #{output_path}"
    else
      puts "ERROR: Failed to create snapshot"
      puts result.stderr
      exit 1
    end
  end

  desc "Restore a snapshot to the test database (test environment only)"
  task :restore_snapshot, [:name, :truncate_first] => :environment do |t, args|
    unless Rails.env.test?
      puts "ERROR: This task can only be run in the test environment"
      puts "Current environment: #{Rails.env}"
      exit 1
    end

    unless args[:name]
      puts "ERROR: Snapshot name is required"
      puts "Usage: rake db:test:restore_snapshot[snapshot_name] or rake db:test:restore_snapshot[snapshot_name,true]"
      exit 1
    end

    input_path = SNAPSHOT_DIR.join("#{args[:name]}.sql")
    
    unless File.exist?(input_path)
      puts "ERROR: Snapshot '#{args[:name]}' does not exist at #{input_path}"
      puts "Available snapshots:"
      Dir.glob(SNAPSHOT_DIR.join("*.sql")).each do |file|
        puts "  - #{File.basename(file, '.sql')}"
      end
      exit 1
    end

    if args[:truncate_first] == "true"
      Database::Snapshotter.new.truncate
      puts "Database truncated before restore"
    end

    result = Database::Snapshotter.new.restore(input_path)

    if result.success?
      puts "Snapshot '#{args[:name]}' restored successfully"
    else
      puts "ERROR: Failed to restore snapshot"
      puts result.stderr
      exit 1
    end
  end

  desc "List all available test database snapshots"
  task list_snapshots: :environment do
    unless Rails.env.test?
      puts "ERROR: This task can only be run in the test environment"
      puts "Current environment: #{Rails.env}"
      exit 1
    end

    ensure_snapshots_directory_exists
    
    snapshots = Dir.glob(SNAPSHOT_DIR.join("*.sql"))
    
    if snapshots.empty?
      puts "No snapshots found in #{SNAPSHOT_DIR}"
    else
      puts "Available snapshots:"
      snapshots.each do |file|
        name = File.basename(file, '.sql')
        size = File.size(file) / 1024.0 / 1024.0
        mtime = File.mtime(file)
        puts "  - #{name} (#{size.round(2)} MB, created: #{mtime.strftime('%Y-%m-%d %H:%M:%S')})"
      end
    end
  end

  private

  def ensure_snapshots_directory_exists
    SNAPSHOT_DIR.mkpath unless SNAPSHOT_DIR.exist?
  end
end