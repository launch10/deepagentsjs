module Database
  class PgDumpFlags
    BOOLEAN_FLAGS = {
      schema_only: "--schema-only",
      data_only: "--data-only",
      clean: "--clean",
      if_exists: "--if-exists",
      create: "--create",
      no_owner: "--no-owner",
      no_privileges: "--no-privileges",
      no_comments: "--no-comments",
      no_publications: "--no-publications",
      no_security_labels: "--no-security-labels",
      no_subscriptions: "--no-subscriptions",
      no_tablespaces: "--no-tablespaces",
      no_unlogged_table_data: "--no-unlogged-table-data",
      inserts: "--inserts",
      column_inserts: "--column-inserts",
      disable_triggers: "--disable-triggers",
      enable_row_security: "--enable-row-security",
      no_synchronized_snapshots: "--no-synchronized-snapshots",
      no_blobs: "--no-blobs",
      blobs: "--blobs",
      verbose: "--verbose"
    }.freeze

    ARRAY_FLAGS = {
      tables: "-t",
      exclude_tables: "--exclude-table",
      schemas: "-n",
      exclude_schemas: "--exclude-schema"
    }.freeze

    VALUE_FLAGS = {
      format: "--format",
      jobs: "--jobs",
      compress: "--compress",
      lock_wait_timeout: "--lock-wait-timeout",
      encoding: "--encoding"
    }.freeze

    def initialize(**options)
      @options = options
    end

    def to_a
      flags = []

      @options.each do |key, value|
        next if value.nil? || value == false

        if BOOLEAN_FLAGS.key?(key)
          flags << BOOLEAN_FLAGS[key] if value
        elsif ARRAY_FLAGS.key?(key)
          Array(value).each do |v|
            flags << ARRAY_FLAGS[key]
            flags << v.to_s
          end
        elsif VALUE_FLAGS.key?(key)
          flags << VALUE_FLAGS[key]
          flags << value.to_s
        end
      end

      flags
    end

    def self.build(**)
      new(**).to_a
    end
  end
end
