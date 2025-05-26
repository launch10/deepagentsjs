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

    config = ActiveRecord::Base.connection_db_config.configuration_hash

    command = "psql"
    command << " -U #{config[:username]}" if config[:username]
    command << " -h #{config[:host]}" if config[:host]
    command << " -p #{config[:port]}" if config[:port]
    command << " -d #{config[:database]}"
    command << " -f #{filepath}"

    puts "Executing: #{command.gsub(config[:password].to_s, '********')}"
    
    success = system(command)

    if success
      puts "Successfully imported data from #{filepath}."
    else
      puts "Error importing data. Check psql output above. Exit status: #{$?.exitstatus}"
    end
  end
end