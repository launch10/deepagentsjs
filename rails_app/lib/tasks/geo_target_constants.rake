namespace :db do
  namespace :geo_target_constants do
    desc "Seed geo_target_constants from db/seeds/geo_target_constants.sql"
    task seed: :environment do
      sql_path = Rails.root.join("db/seeds/geo_target_constants.sql")

      unless File.exist?(sql_path)
        puts "ERROR: Seed file not found at #{sql_path}"
        exit 1
      end

      puts "Truncating geo_target_constants..."
      GeoTargetConstant.delete_all

      puts "Loading geo_target_constants from seed file..."
      config = ActiveRecord::Base.connection_db_config.configuration_hash
      env = {"PGPASSWORD" => config[:password].to_s}

      command = [
        "psql",
        "-U", config[:username],
        "-h", config[:host] || "localhost",
        "-p", (config[:port] || 5432).to_s,
        "--no-password",
        "-q",
        "-d", config[:database],
        "-f", sql_path.to_s
      ].join(" ")

      system(env, command)

      if $?.success?
        puts "Successfully seeded #{GeoTargetConstant.count} geo_target_constants"
      else
        puts "ERROR: Failed to seed geo_target_constants"
        exit 1
      end
    end

    desc "Dump geo_target_constants to test/fixtures/database/snapshots/geo_target_constants.sql"
    task dump: :environment do
      output_path = Rails.root.join("test/fixtures/database/snapshots/geo_target_constants.sql")
      FileUtils.mkdir_p(output_path.dirname)

      count = GeoTargetConstant.count
      if count == 0
        puts "WARNING: No geo_target_constants in database. Run db:geo_target_constants:seed first."
        exit 1
      end

      puts "Dumping #{count} geo_target_constants to #{output_path}..."

      config = ActiveRecord::Base.connection_db_config.configuration_hash
      env = {"PGPASSWORD" => config[:password].to_s}

      command = [
        "pg_dump",
        "-U", config[:username],
        "-h", config[:host] || "localhost",
        "-p", (config[:port] || 5432).to_s,
        "--no-password",
        "--data-only",
        "--inserts",
        "--column-inserts",
        "-t", "geo_target_constants",
        config[:database]
      ].join(" ")

      system(env, "#{command} > #{output_path}")

      if $?.success?
        size = File.size(output_path) / 1024.0 / 1024.0
        puts "Successfully dumped geo_target_constants (#{size.round(2)} MB)"
      else
        puts "ERROR: Failed to dump geo_target_constants"
        exit 1
      end
    end

    desc "Seed and dump geo_target_constants (seed from db/seeds, dump to test/fixtures/database/snapshots)"
    task refresh: [:seed, :dump]
  end
end
