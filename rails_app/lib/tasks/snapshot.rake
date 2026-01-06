namespace :db do
  desc "Truncate all tables in the test database (test environment only)"
  task truncate: :environment do
    unless Rails.env.test?
      puts "ERROR: This task can only be run in the test environment"
      puts "Current environment: #{Rails.env}"
      exit 1
    end

    require "database_cleaner-active_record"
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
      puts "Usage: rake db:snapshot[snapshot_name]"
      exit 1
    end

    result = Database::Snapshotter.create_snapshot(args[:name])

    if result.success?
      puts "Snapshot '#{args[:name]}' created successfully"
    else
      puts "ERROR: Failed to create snapshot"
      puts result.stderr
      exit 1
    end
  end

  desc "Restore a snapshot to the test database (test environment only)"
  task :restore_snapshot, [:name, :truncate_first] => :environment do |t, args|
    unless Rails.env.test? || Rails.env.development?
      puts "ERROR: This task can only be run in the test or development environment"
      puts "Current environment: #{Rails.env}"
      exit 1
    end

    unless args[:name]
      puts "ERROR: Snapshot name is required"
      puts "Usage: rake db:restore_snapshot[snapshot_name] or rake db:restore_snapshot[snapshot_name,false]"
      exit 1
    end

    truncate = args[:truncate_first] != "false"

    begin
      Database::Snapshotter.restore_snapshot(args[:name], truncate: truncate)
      puts "Database truncated before restore" if truncate
      puts "Snapshot '#{args[:name]}' restored successfully"
    rescue => e
      puts "ERROR: #{e.message}"
      puts "Available snapshots:"
      Database::Snapshotter.list_snapshots.each do |snapshot|
        puts "  - #{snapshot[:name]}"
      end
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

    snapshots = Database::Snapshotter.list_snapshots

    if snapshots.empty?
      puts "No snapshots found"
    else
      puts "Available snapshots:"
      snapshots.each do |snapshot|
        puts "  - #{snapshot[:name]} (#{snapshot[:size_mb]} MB, created: #{snapshot[:created_at].strftime("%Y-%m-%d %H:%M:%S")})"
      end
    end
  end
end
