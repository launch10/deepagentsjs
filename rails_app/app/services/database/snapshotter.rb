require "open3"
require "shellwords"

module Database
  class Snapshotter
    # Custom error for cleaner handling
    class CommandError < StandardError
      attr_reader :status, :stderr

      def initialize(message, status:, stderr:)
        super(message)
        @status = status
        @stderr = stderr
      end
    end

    # A read-only struct for the command result
    Result = Struct.new(:success?, :stdout, :stderr, :status, keyword_init: true)

    # Rails system tables that should not be included in data snapshots
    # These tables are managed by Rails and should maintain their state
    # across test runs to ensure proper framework operation
    EXCLUDED_SYSTEM_TABLES = %w[
      ar_internal_metadata
      schema_migrations
    ].freeze

    def initialize
      @config = ActiveRecord::Base.connection_db_config.configuration_hash
      @env = {"PGPASSWORD" => @config[:password].to_s}
    end

    class << self
      extend Forwardable
      def_delegators :new, :restore, :dump, :export_tables, :list_snapshots, :truncate, :reset_all_sequences
    end

    # Dumps the database to a file.
    #
    # @param output_path [String] The path to the output .sql file.
    # @param pg_dump_options [Hash] Options passed to PgDumpFlags (e.g., clean: true, no_owner: true)
    # @return [Result]
    def dump(output_path, **pg_dump_options)
      # Normalize the output path by replacing hyphens with underscores in filename
      output_path = normalize_snapshot_path(output_path)

      default_options = {
        data_only: true,
        inserts: true,
        column_inserts: true,
        disable_triggers: true,
        exclude_tables: EXCLUDED_SYSTEM_TABLES
      }

      # Dump data to temp file first
      temp_data_file = "#{output_path}.data.tmp"
      data_result = pg_dump(temp_data_file, **default_options.merge(pg_dump_options))

      return data_result unless data_result.success?

      # Now get sequence values and append them
      sequence_sql = get_sequence_reset_sql

      # Combine data and sequences into final output
      FileUtils.rm(output_path) if File.exist?(output_path)

      File.open(output_path, "w") do |f|
        f.puts "-- Database snapshot created at #{Time.now}"
        f.puts "-- Disable triggers during restore"
        f.puts "SET session_replication_role = 'replica';"
        f.puts
        f.write File.read(temp_data_file)
        f.puts
        f.puts "-- Re-enable triggers"
        f.puts "SET session_replication_role = 'origin';"
        f.puts
        f.puts "-- Reset sequences to current values"
        f.puts sequence_sql
      end

      # Clean up temp file
      File.delete(temp_data_file) if File.exist?(temp_data_file)

      Result.new(success?: true, stdout: "Snapshot created with data and sequences", stderr: "", status: nil)
    end

    # Restores the database from a file.
    #
    # @param input_path [String] The path to the input .sql file.
    # @return [Result]
    def restore(input_path)
      # Normalize the input path by replacing hyphens with underscores in filename
      input_path = normalize_snapshot_path(input_path)
      raise "File not found: #{input_path}" unless File.exist?(input_path)

      # Create necessary partitions before restoring data
      ensure_partitions_exist(input_path)

      command_args = [
        "psql",
        "-U", @config[:username],
        "-h", @config[:host] || "localhost",
        "-p", @config[:port].to_s,
        "--no-password",
        "-v", "ON_ERROR_STOP=1",  # Stop on first error
        "-d", @config[:database],
        "-f", input_path
      ]

      execute_command(Shellwords.join(command_args))
    end

    def truncate
      DatabaseCleaner.clean_with(:truncation)
    end

    def reset_all_sequences(start_value: 1)
      connection = ActiveRecord::Base.connection

      sequence_query = <<-SQL
        SELECT schemaname, sequencename
        FROM pg_sequences
        WHERE schemaname = 'public'
      SQL

      sequences = connection.execute(sequence_query)

      sequences.each do |seq|
        connection.execute("SELECT setval('#{seq["schemaname"]}.#{seq["sequencename"]}', #{start_value}, false);")
      end

      puts "Reset #{sequences.count} sequences to #{start_value}"
    end

    def export_tables(file, **)
      pg_dump(file, **)
    end

    def delete_test_snapshots
      Test::DatabaseController::SNAPSHOT_DIR.glob("test_snapshot_*.sql").each do |file|
        file.delete if file.exist?
      end
    end

    private

    def pg_dump(output_path, **)
      flags = PgDumpFlags.build(**)

      command_args = [
        "pg_dump",
        "-U", @config[:username],
        "-h", @config[:host] || "localhost",
        "-p", @config[:port].to_s,
        "--no-password",
        *flags,
        @config[:database]
      ]

      command = Shellwords.join(command_args) + " > #{Shellwords.escape(output_path)}"
      execute_command(command)
    end

    def ensure_partitions_exist(snapshot_path)
      # Read the snapshot file to identify partition tables referenced
      content = File.read(snapshot_path)

      # Find all partition table references for domain_request_counts and account_request_counts
      # Both are now monthly partitions with format YYYY_MM
      domain_partitions = content.scan(/domain_request_counts_(\d{4}_\d{2})(?:_\d{2}_\d{2})?/).flatten.uniq
      account_partitions = content.scan(/account_request_counts_(\d{4}_\d{2})/).flatten.uniq

      # Create domain_request_counts monthly partitions
      domain_partitions.each do |partition_suffix|
        # Handle both old hourly format (for migration) and new monthly format
        if partition_suffix =~ /^(\d{4})_(\d{2})$/
          year, month = $1.to_i, $2.to_i
          start_time = Time.zone.local(year, month, 1)
          end_time = start_time + 1.month
          partition_name = "domain_request_counts_#{partition_suffix}"

          create_partition_if_not_exists("domain_request_counts", partition_name, start_time, end_time)
        end
      end

      # Also handle old hourly partitions in snapshots (for backward compatibility)
      hourly_domain_partitions = content.scan(/domain_request_counts_(\d{4}_\d{2}_\d{2}_\d{2})/).flatten.uniq
      hourly_domain_partitions.each do |partition_suffix|
        if partition_suffix =~ /(\d{4})_(\d{2})_(\d{2})_(\d{2})/
          year, month = $1.to_i, $2.to_i
          # Convert hourly to monthly partition
          monthly_suffix = "#{year.to_s.rjust(4, "0")}_#{month.to_s.rjust(2, "0")}"
          start_time = Time.zone.local(year, month, 1)
          end_time = start_time + 1.month
          partition_name = "domain_request_counts_#{monthly_suffix}"

          create_partition_if_not_exists("domain_request_counts", partition_name, start_time, end_time)
        end
      end

      # Create account_request_counts monthly partitions
      account_partitions.each do |partition_suffix|
        if partition_suffix =~ /(\d{4})_(\d{2})/
          year, month = $1.to_i, $2.to_i
          start_time = Time.zone.local(year, month, 1)
          end_time = start_time + 1.month
          partition_name = "account_request_counts_#{partition_suffix}"

          create_partition_if_not_exists("account_request_counts", partition_name, start_time, end_time)
        end
      end
    rescue => e
      Rails.logger.warn "Failed to ensure partitions exist: #{e.message}"
      # Continue with restore even if partition creation fails
    end

    def create_partition_if_not_exists(parent_table, partition_name, start_time, end_time)
      # Check if partition already exists
      result = ActiveRecord::Base.connection.execute(<<-SQL)
        SELECT 1 FROM pg_tables
        WHERE tablename = '#{partition_name}'
        AND schemaname = 'public'
        LIMIT 1;
      SQL

      # Create partition if it doesn't exist
      if result.count == 0
        ActiveRecord::Base.connection.execute(<<-SQL)
          CREATE TABLE IF NOT EXISTS #{partition_name}
          PARTITION OF #{parent_table}
          FOR VALUES FROM ('#{start_time.to_fs(:db)}') TO ('#{end_time.to_fs(:db)}')
        SQL
        puts "✅ Created partition #{partition_name}"
      end
    rescue => e
      Rails.logger.warn "Failed to create partition #{partition_name}: #{e.message}"
    end

    def normalize_snapshot_path(path)
      # Convert path to Pathname for easier manipulation
      pathname = Pathname.new(path.to_s.gsub("-", "_"))

      FileUtils.mkdir_p(pathname.dirname)

      pathname.to_s
    end

    def get_sequence_reset_sql
      connection = ActiveRecord::Base.connection

      sequence_query = <<-SQL
        SELECT schemaname, sequencename
        FROM pg_sequences
        WHERE schemaname = 'public'
      SQL

      sequences = connection.execute(sequence_query)

      # PostgreSQL setval behavior:
      # is_called: "Has the sequence been called EVER?"
      # - setval('seq', 1, false) → next nextval() returns 1
      # - setval('seq', 1, true) → next nextval() returns 2
      sql_statements = sequences.map do |seq|
        seq_name = "#{seq["schemaname"]}.#{seq["sequencename"]}"
        result = connection.execute("SELECT last_value, is_called FROM #{seq_name}").first
        last_value = result["last_value"] || 1
        is_called = result["is_called"] == "t" || result["is_called"] == true
        "SELECT setval('#{seq_name}', #{last_value}, #{is_called});"
      end

      sql_statements.join("\n")
    end

    def execute_command(command)
      puts "Executing command..." # Don't log the full command if it contains secrets
      stdout, stderr, status = Open3.capture3(@env, command)

      # Always show stderr if there's any output, even on success
      # psql writes normal output to stderr, so only show if it looks like an error
      if stderr.present? && (stderr.include?("ERROR") || stderr.include?("FATAL") || !status.success?)
        puts "\n⚠️  Database output:"
        puts stderr
      end

      if status.success?
        puts "✅ Command successful."
        Result.new(success?: true, stdout: stdout, stderr: stderr, status: status)
      else
        puts "\n❌ Command failed!"
        puts "Error output: #{stderr}" if stderr.present?

        # Raise an error or return a failed result object
        raise CommandError.new(
          "Database command failed with status #{status.exitstatus}.",
          status: status,
          stderr: stderr
        )
      end
    end
  end
end
