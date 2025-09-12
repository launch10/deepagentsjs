namespace :db do
  desc "Import data from a SQL file (expects INSERT statements)"
  task :import_sql_file, [:filepath] => :environment do |task, args|
    filepath = args[:filepath]

    unless filepath && File.exist?(filepath)
      puts "Please provide a valid filepath."
      puts "Usage: rails db:import_sql_file['path/to/your/data_export.sql']"
      exit 1
    end

    puts "Importing data from #{filepath}..."

    result = Database::Snapshotter.new.restore(filepath)

    if result.success?
      puts "Successfully imported data from #{filepath}."
    else
      puts "Error importing data. Check psql output above. Exit status: #{result.status.exitstatus}"
    end
  end
end