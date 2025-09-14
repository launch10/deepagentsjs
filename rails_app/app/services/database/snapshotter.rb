require 'open3'
require 'shellwords'

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
      @env = { 'PGPASSWORD' => @config[:password].to_s }
    end

    # Dumps the database to a file.
    #
    # @param output_path [String] The path to the output .sql file.
    # @param options [Array<String>] Extra flags for pg_dump (e.g., ['--clean', '--if-exists'])
    # @return [Result]
    def dump(output_path, options: [])
      # Normalize the output path by replacing hyphens with underscores in filename
      output_path = normalize_snapshot_path(output_path)
      # Build exclusion flags for system tables
      exclusions = EXCLUDED_SYSTEM_TABLES.flat_map { |table| ['--exclude-table', table] }
      
      # First dump the data
      data_command_args = [
        'pg_dump',
        '-U', @config[:username],
        '-h', @config[:host] || 'localhost',
        '-p', @config[:port].to_s,
        '--no-password',
        '--data-only',
        '--inserts',
        '--column-inserts',
        '--disable-triggers', # Disable triggers during restore for faster loading
        *exclusions,  # Exclude Rails system tables
        *options,
        @config[:database]
      ]

      # Dump data to temp file first
      temp_data_file = "#{output_path}.data.tmp"
      data_command = Shellwords.join(data_command_args) + " > #{Shellwords.escape(temp_data_file)}"
      data_result = execute_command(data_command)
      
      return data_result unless data_result.success?

      # Now get sequence values and append them
      sequence_sql = get_sequence_reset_sql
      
      # Combine data and sequences into final output
      File.open(output_path, 'w') do |f|
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

      command_args = [
        'psql',
        '-U', @config[:username],
        '-h', @config[:host] || 'localhost',
        '-p', @config[:port].to_s,
        '--no-password',
        '-v', 'ON_ERROR_STOP=1',  # Stop on first error
        '-d', @config[:database],
        '-f', input_path
      ]

      execute_command(Shellwords.join(command_args))
    end

    private

    def normalize_snapshot_path(path)
      # Convert path to Pathname for easier manipulation
      pathname = Pathname.new(path)
      
      # Get the filename without extension
      basename = pathname.basename('.sql').to_s
      
      # Replace hyphens with underscores in the filename
      normalized_basename = basename.gsub('-', '_')
      
      # Reconstruct the path with normalized filename
      pathname.dirname.join("#{normalized_basename}.sql").to_s
    end

    def get_sequence_reset_sql
      connection = ActiveRecord::Base.connection
      
      # Query to get all sequences and their current values
      sequence_query = <<-SQL
        SELECT 
          schemaname,
          sequencename,
          last_value,
          increment_by
        FROM pg_sequences
        WHERE schemaname = 'public'
      SQL
      
      sequences = connection.execute(sequence_query)
      
      sql_statements = sequences.map do |seq|
        # Generate a setval statement for each sequence
        # The third parameter (true) ensures the next value will be correct
        "SELECT setval('#{seq['schemaname']}.#{seq['sequencename']}', #{seq['last_value'] || 1}, true);"
      end
      
      sql_statements.join("\n")
    end

    def execute_command(command)
      puts "Executing command..." # Don't log the full command if it contains secrets
      stdout, stderr, status = Open3.capture3(@env, command)

      # Always show stderr if there's any output, even on success
      # psql writes normal output to stderr, so only show if it looks like an error
      if stderr.present? && (stderr.include?('ERROR') || stderr.include?('FATAL') || !status.success?)
        puts "\n⚠️  Database output:"
        puts stderr
      end

      if status.success?
        puts "✅ Command successful."
        Result.new(success?: true, stdout: stdout, stderr: stderr, status: status)
      else
        # Don't duplicate stderr output if we already showed it above
        unless stderr.present? && (stderr.include?('ERROR') || stderr.include?('FATAL'))
          puts "\n❌ Command failed!"
          puts "Error output: #{stderr}" if stderr.present?
        end
        
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