# Website with generated content from scheduling-tool example.
# Use this snapshot when you need a fully built website (not just template state).
#
# Base: website_step (has brainstorm, theme, uploads, but only template files)
# Output: website_generated (adds scheduling-tool landing page content)
#
class WebsiteGenerated < BaseBuilder
  # Path to scheduling-tool example (relative to Rails root, goes up to project root)
  SCHEDULING_TOOL_DIR = Rails.root.join("..", "shared", "websites", "examples", "scheduling-tool")

  def base_snapshot
    "website_step"
  end

  def output_name
    "website_generated"
  end

  def build
    project = Project.first
    website = project.website

    # Populate website with scheduling-tool example files
    populate_scheduling_tool_files(website)

    puts "Website ID: #{website.id}"
    puts "Total website files: #{website.website_files.count}"
  end

  private

  # Populates website with files from the scheduling-tool example.
  # Creates WebsiteFile records that override template files.
  def populate_scheduling_tool_files(website)
    scheduling_tool_dir = SCHEDULING_TOOL_DIR.to_s

    unless Dir.exist?(scheduling_tool_dir)
      raise "Scheduling tool directory not found: #{scheduling_tool_dir}"
    end

    files_created = 0

    # Walk through all files in the scheduling-tool directory
    Dir.glob(File.join(scheduling_tool_dir, "**", "*")).each do |src_path|
      next if File.directory?(src_path)
      next if skip_file?(src_path)

      relative_path = src_path.sub("#{scheduling_tool_dir}/", "")
      content = File.read(src_path)

      # Create or update WebsiteFile record (overrides template files)
      website_file = website.website_files.find_or_initialize_by(path: relative_path)
      website_file.content = content
      website_file.save!
      files_created += 1
    end

    puts "Created #{files_created} website files from scheduling-tool example"
  end

  # Files/directories to skip when syncing from scheduling-tool
  def skip_file?(path)
    skip_patterns = %w[
      node_modules
      .git
      dist
      .DS_Store
      package-lock.json
      pnpm-lock.yaml
      yarn.lock
      bun.lockb
    ]

    skip_patterns.any? { |pattern| path.include?(pattern) }
  end
end
