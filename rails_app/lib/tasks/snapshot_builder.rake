namespace :db do
  namespace :snapshot do
    desc "Build a new snapshot by restoring a base snapshot, running modifications, and saving"
    task :build, [:builder_name] => :environment do |t, args|
      unless Rails.env.test?
        puts "ERROR: This task can only be run in the test environment"
        puts "Run with: RAILS_ENV=test rake db:snapshot:build[builder_name]"
        exit 1
      end

      builder_name = args[:builder_name]

      unless builder_name.present?
        puts "ERROR: Builder name is required"
        puts "Usage: rake db:snapshot:build[builder_name]"
        puts "  builder_name: Name of builder in spec/snapshot_builders/builders.yml"
        exit 1
      end

      require_snapshot_builder_support!

      SnapshotBuilder.build(builder_name)
    end

    desc "List available snapshots"
    task list: :environment do
      require_snapshot_builder_support!
      BuilderFinder.list_available_builders
    end

    desc "Build all snapshots in dependency order"
    task build_all: :environment do
      unless Rails.env.test?
        puts "ERROR: This task can only be run in the test environment"
        puts "Run with: RAILS_ENV=test rake db:snapshot:build_all"
        exit 1
      end

      require_snapshot_builder_support!

      builders = BuilderFinder.builder_config.keys
      if builders.empty?
        puts "No builders found"
        exit 0
      end

      sorted = TopologicalSort.sort(builders)
      puts "Building #{sorted.length} snapshots in order: #{sorted.join(" -> ")}"
      puts

      sorted.each do |builder_name|
        puts "=" * 60
        SnapshotBuilder.build(builder_name, force: true)
        puts
      end

      puts "All snapshots built successfully!"
    end

    desc "Show dependency graph for a builder"
    task :deps, [:builder_name] => :environment do |t, args|
      unless Rails.env.test?
        puts "ERROR: This task can only be run in the test environment"
        exit 1
      end

      require_snapshot_builder_support!

      builder_name = args[:builder_name]

      if builder_name.present?
        chain = SnapshotBuilder.dependency_chain(builder_name)
        puts "Dependency chain for '#{builder_name}':"
        chain.each_with_index do |dep, i|
          indent = "  " * i
          puts "#{indent}-> #{dep}"
        end
      else
        puts "All builder dependencies:"
        BuilderFinder.builder_config.each_key do |name|
          chain = SnapshotBuilder.dependency_chain(name)
          puts "  #{name}: #{chain.join(" -> ")}"
        end
      end
    end

    desc "Interactive snapshot builder - restore, modify in console, then save"
    task :interactive, [:base_snapshot] => :environment do |t, args|
      unless Rails.env.test?
        puts "ERROR: This task can only be run in the test environment"
        exit 1
      end

      require_snapshot_builder_support!

      snapshot_dir = Rails.root.join("test/fixtures/database/snapshots")
      base_snapshot = args[:base_snapshot]

      puts "=== Interactive Snapshot Builder ==="

      puts "Truncating database..."
      Database::Snapshotter.truncate

      if base_snapshot.present? && base_snapshot != "empty"
        input_path = snapshot_dir.join("#{base_snapshot}.sql")
        unless File.exist?(input_path)
          puts "ERROR: Base snapshot '#{base_snapshot}' not found"
          exit 1
        end

        puts "Restoring base snapshot '#{base_snapshot}'..."
        Database::Snapshotter.restore(input_path)
      end

      puts
      puts "Database is ready. You now have access to:"
      puts "  - FactoryBot methods (create, build, etc.)"
      puts "  - All spec support helpers"
      puts
      puts "When done, call: save_snapshot('snapshot_name')"
      puts "Or exit without saving: exit"
      puts

      define_method(:save_snapshot) do |name|
        output_path = snapshot_dir.join("#{name}.sql")
        puts "Creating snapshot '#{name}'..."
        result = Database::Snapshotter.dump(output_path)
        if result.success?
          puts "Snapshot saved to #{output_path}"
        else
          puts "ERROR: #{result.stderr}"
        end
      end

      require "irb"
      IRB.start
    end
  end
end

def require_snapshot_builder_support!
  require "factory_bot_rails"
  require "database_cleaner/active_record"

  FactoryBot.reload

  Rails.root.glob("spec/support/**/*.rb").sort_by(&:to_s).each { |f| require f }

  builders_dir = Rails.root.join("spec/snapshot_builders")
  if builders_dir.exist?
    builders_dir.glob("**/*.rb").sort_by(&:to_s).each { |f| require f }
  end

  include FactoryBot::Syntax::Methods

  if defined?(PlanHelpers)
    include PlanHelpers
  end
  if defined?(SubscriptionHelpers)
    include SubscriptionHelpers
  end
  if defined?(AccountHelpers)
    include AccountHelpers
  end
end

class SnapshotBuilder
  SNAPSHOT_DIR = Rails.root.join("test/fixtures/database/snapshots")

  class << self
    def build(builder_name, force: false)
      SNAPSHOT_DIR.mkpath unless SNAPSHOT_DIR.exist?

      builder_class = BuilderFinder.find_builder_class(builder_name)
      if builder_class.nil?
        puts "ERROR: Builder '#{builder_name}' not found"
        BuilderFinder.list_available_builders
        exit 1
      end

      builder = builder_class.new
      output_name = builder.output_name
      output_path = SNAPSHOT_DIR.join("#{output_name}.sql")

      if !force && File.exist?(output_path)
        puts "Snapshot '#{output_name}' already exists, skipping (use force: true to rebuild)"
        return
      end

      ensure_dependencies_exist(builder)

      run_build(builder_name, builder)
    end

    def dependency_chain(builder_name, chain: [])
      builder_class = BuilderFinder.find_builder_class(builder_name)
      return chain if builder_class.nil?

      builder = builder_class.new
      base = builder.base_snapshot

      if base.present? && BuilderFinder.find_builder_class(base)
        dependency_chain(base, chain: chain)
      elsif base.present?
        chain << base
      end

      chain << builder_name
      chain
    end

    private

    def ensure_dependencies_exist(builder)
      base_snapshot = builder.base_snapshot
      return if base_snapshot.blank?

      base_path = SNAPSHOT_DIR.join("#{base_snapshot}.sql")

      if File.exist?(base_path)
        puts "Base snapshot '#{base_snapshot}' exists"
        return
      end

      base_builder_class = BuilderFinder.find_builder_class(base_snapshot)
      if base_builder_class.nil?
        puts "ERROR: Base snapshot '#{base_snapshot}' not found and no builder exists for it"
        exit 1
      end

      puts "Base snapshot '#{base_snapshot}' missing, building it first..."
      puts
      build(base_snapshot)
      puts
      puts "Continuing with original build..."
    end

    def run_build(builder_name, builder)
      base_snapshot = builder.base_snapshot
      output_name = builder.output_name

      puts "=== Snapshot Builder ==="
      puts "Builder: #{builder_name}"
      puts "Base: #{base_snapshot || "empty"}"
      puts "Output: #{output_name}"
      puts

      if base_snapshot.present?
        puts "Truncating database..."
        Database::Snapshotter.truncate
      else
        puts "Resetting database (drop, create, load schema)..."
        ActiveRecord::Base.connection_pool.disconnect!
        Rake::Task["db:drop"].invoke
        Rake::Task["db:create"].invoke
        Rake::Task["db:schema:load"].invoke
        ActiveRecord::Base.connection_pool.disconnect!
        ActiveRecord::Base.establish_connection
        ActiveRecord::Base.connection.reconnect!
        ActiveRecord::Base.descendants.each(&:reset_column_information)
        puts "Schema loaded. Tables: #{ActiveRecord::Base.connection.tables.count}"
      end

      if base_snapshot.present?
        input_path = SNAPSHOT_DIR.join("#{base_snapshot}.sql")
        unless File.exist?(input_path)
          puts "ERROR: Base snapshot '#{base_snapshot}' not found at #{input_path}"
          exit 1
        end

        puts "Restoring base snapshot '#{base_snapshot}'..."
        result = Database::Snapshotter.restore(input_path)
        unless result.success?
          puts "ERROR: Failed to restore base snapshot"
          puts result.stderr
          exit 1
        end
      end

      puts "Running builder '#{builder_name}'..."
      builder.build
      puts "Builder completed."

      output_path = SNAPSHOT_DIR.join("#{output_name}.sql")
      puts "Creating snapshot '#{output_name}'..."
      result = Database::Snapshotter.dump(output_path)

      if result.success?
        size = File.size(output_path) / 1024.0 / 1024.0
        puts "Snapshot '#{output_name}' created successfully (#{size.round(2)} MB)"
      else
        puts "ERROR: Failed to create snapshot"
        puts result.stderr
        exit 1
      end
    end
  end
end

class TopologicalSort
  class << self
    def sort(builder_names)
      graph = {}
      builder_names.each do |name|
        config = BuilderFinder.builder_config[name]
        base = config&.dig("base_snapshot")
        graph[name] = (base && builder_names.include?(base)) ? [base] : []
      end

      sorted = []
      visited = Set.new
      temp_visited = Set.new

      visit = lambda do |node|
        return if visited.include?(node)
        raise "Circular dependency detected at #{node}" if temp_visited.include?(node)

        temp_visited.add(node)
        graph[node].each { |dep| visit.call(dep) }
        temp_visited.delete(node)
        visited.add(node)
        sorted << node
      end

      builder_names.each { |name| visit.call(name) }
      sorted
    end
  end
end

class BuilderFinder
  class << self
    def list_available_builders
      config = builder_config
      if config.empty?
        puts "No builders found in spec/snapshot_builders/builders.yml"
      else
        puts "Available builders:"
        config.each do |name, settings|
          desc = settings["description"] || "No description"
          puts "  - #{name}: #{desc}"
        end
      end
    end

    def find_builder_class(name)
      config = builder_config[name]
      return nil unless config

      class_name = config["class"]
      return nil unless class_name

      if Object.const_defined?(class_name)
        Object.const_get(class_name)
      elsif Object.const_defined?("SnapshotBuilders::#{class_name}")
        Object.const_get("SnapshotBuilders::#{class_name}")
      end
    end

    def builder_config
      @builder_config ||= begin
        yml_path = Rails.root.join("spec/snapshot_builders/builders.yml")
        if File.exist?(yml_path)
          YAML.load_file(yml_path)
        else
          {}
        end
      end
    end
  end
end
