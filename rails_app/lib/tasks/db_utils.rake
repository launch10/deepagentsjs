namespace :db do
  desc "Kill all connections to a database (default: current environment's database)"
  task :kill_connections, [:database] => :environment do |t, args|
    database = args[:database] || ActiveRecord::Base.connection_db_config.configuration_hash[:database]
    config = ActiveRecord::Base.connection_db_config.configuration_hash

    puts "Killing connections to #{database}..."

    # Connect to postgres database to run the termination query
    env = {"PGPASSWORD" => config[:password].to_s}
    sql = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '#{database}' AND pid <> pg_backend_pid();"

    require "open3"
    stdout, _, _ = Open3.capture3(
      env,
      "psql",
      "-U", config[:username],
      "-h", config[:host] || "localhost",
      "-p", (config[:port] || 5432).to_s,
      "--no-password",
      "-d", "postgres",
      "-c", sql
    )

    terminated = stdout.scan(/^ t$/).count
    puts "Terminated #{terminated} connection(s) to #{database}"
  end

  desc "Show active connections to a database (default: current environment's database)"
  task :connections, [:database] => :environment do |t, args|
    database = args[:database] || ActiveRecord::Base.connection_db_config.configuration_hash[:database]
    config = ActiveRecord::Base.connection_db_config.configuration_hash

    env = {"PGPASSWORD" => config[:password].to_s}
    sql = "SELECT pid, usename, application_name, state, left(query, 80) as query FROM pg_stat_activity WHERE datname = '#{database}';"

    require "open3"
    stdout, _, _ = Open3.capture3(
      env,
      "psql",
      "-U", config[:username],
      "-h", config[:host] || "localhost",
      "-p", (config[:port] || 5432).to_s,
      "--no-password",
      "-d", "postgres",
      "-c", sql
    )

    puts stdout
  end
end
