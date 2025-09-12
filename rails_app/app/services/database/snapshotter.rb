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
      # Securely build the command arguments
      command_args = [
        'pg_dump',
        '-U', @config[:username],
        '-h', @config[:host] || 'localhost',
        '-p', @config[:port].to_s,
        '--no-password', # Important: we are using PGPASSWORD
        *options,
        @config[:database]
      ]

      # Redirect stdout to the file
      command_string = Shellwords.join(command_args) + " > #{Shellwords.escape(output_path)}"

      execute_command(command_string)
    end

    # Restores the database from a file.
    #
    # @param input_path [String] The path to the input .sql file.
    # @return [Result]
    def restore(input_path)
      raise "File not found: #{input_path}" unless File.exist?(input_path)

      command_args = [
        'psql',
        '-U', @config[:username],
        '-h', @config[:host] || 'localhost',
        '-p', @config[:port].to_s,
        '--no-password',
        '-d', @config[:database],
        '-f', input_path
      ]

      execute_command(Shellwords.join(command_args))
    end

    private

    def execute_command(command)
      puts "Executing command..." # Don't log the full command if it contains secrets
      stdout, stderr, status = Open3.capture3(@env, command)

      if status.success?
        puts "Command successful."
        Result.new(success?: true, stdout: stdout, stderr: stderr, status: status)
      else
        puts "Command failed!"
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