# Syncs template files from local directory to database.
#
# Usage:
#   TemplateSyncer.sync!("default")                    # Sync all files
#   TemplateSyncer.sync!("default", only: ["src/lib/tracking.ts"])  # Sync specific files
#
class TemplateSyncer
  TEMPLATES_DIR = Rails.root.join("templates")

  class << self
    def sync_all!
      Dir.glob(File.join(TEMPLATES_DIR, "*"), File::FNM_DOTMATCH).each do |template_dir|
        sync!(File.basename(template_dir))
      end
    end

    def sync!(template_name, only: nil, dir: nil)
      template_dir = TEMPLATES_DIR.join(dir || template_name)

      unless Dir.exist?(template_dir)
        raise "Template directory not found: #{template_dir}"
      end

      template = Template.find_or_create_by!(name: template_name)

      files_synced = 0
      files_to_sync(template_dir, only: only).each do |src_path|
        relative_path = src_path.sub("#{template_dir}/", "")
        content = File.read(src_path)

        upsert_file!(template, relative_path, content)
        files_synced += 1
      end

      puts "[TemplateSyncer] Synced #{files_synced} files for template '#{template_name}'"
      template
    end

    private

    def files_to_sync(template_dir, only: nil)
      if only.present?
        # Only sync specific files
        only.map { |path| File.join(template_dir, path) }.select { |f| File.exist?(f) }
      else
        # Sync all files
        Dir.glob(File.join(template_dir, "**", "*"), File::FNM_DOTMATCH).reject do |src|
          skip_file?(src, template_dir)
        end
      end
    end

    def skip_file?(src, template_dir)
      return true if File.directory?(src) && !File.symlink?(src)
      return true if src.include?("node_modules")
      return true if src.include?("/.git")
      return true if src.include?("/dist/")

      relative = src.sub("#{template_dir}/", "")
      return true if relative == ".env"
      return true if relative.start_with?(".") && !relative.include?("/")  # Skip root hidden files

      false
    end

    def upsert_file!(template, path, content)
      file = template.files.find_or_initialize_by(path: path)
      file.content = content
      file.save!
      file
    end
  end
end
