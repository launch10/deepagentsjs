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

    begin
      result = Database::Snapshotter.new.restore(filepath)

      if result.success?
        puts "Successfully imported data from #{filepath}."
      else
        puts "Error importing data. Check psql output above. Exit status: #{result.status.exitstatus}"
        exit 1
      end
    rescue Database::Snapshotter::CommandError => e
      puts "\n❌ IMPORT FAILED!"
      puts "=" * 60
      puts "Error: #{e.message}"
      if e.stderr.present?
        puts "\nDatabase Error Details:"
        puts e.stderr
      end
      puts "=" * 60
      puts "\nThis usually means:"
      puts "  • Schema mismatch between source and target databases"
      puts "  • Missing columns or tables in the target database"
      puts "  • Data integrity constraints being violated"
      puts "\nTry running: RAILS_ENV=#{Rails.env} rake db:migrate"
      exit 1
    end
  end
end
