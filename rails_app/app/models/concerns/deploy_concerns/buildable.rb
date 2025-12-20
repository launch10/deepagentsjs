module DeployConcerns
  module Buildable
    extend ActiveSupport::Concern

    included do
      before_create :validate_website_has_files
      before_create :ensure_snapshot_exists
      before_create :set_shasum
    end

    def build!
      update!(status: "building")

      FileUtils.mkdir_p(temp_dir)

      # Write all website files to disk
      website.current_history.files.each do |file|
        file_path = File.join(temp_dir, file.path)
        FileUtils.mkdir_p(File.dirname(file_path))
        File.write(file_path, file.content)
      end

      # Run pnpm install and build
      unless build_exists?
        Dir.chdir(temp_dir) do
          system("pnpm install --ignore-workspace") or raise "pnpm install failed"
          system("pnpm run build") or raise "pnpm build failed"
        end
      end

      dist_path = File.join(temp_dir, "dist")
      raise "Build failed: dist directory not found" unless Dir.exist?(dist_path)

      dist_path
    end

    def build_exists?
      Dir.exist?(File.join(temp_dir, "dist"))
    end

    private

    def validate_website_has_files
      if website.files.empty?
        raise "Cannot deploy website without files"
      end
    end

    def ensure_snapshot_exists
      # Only create a new snapshot if files have changed, or no snapshot exists
      if website.files_changed? || website.latest_snapshot.nil?
        snapshot = website.snapshot
        self.snapshot_id = snapshot.snapshot_id
      else
        self.snapshot_id = website.latest_snapshot.snapshot_id
      end
    end

    def set_shasum
      self.shasum = website.generate_shasum
    end

    def temp_dir
      File.join(Dir.tmpdir, "launch10_deploy_#{id}")
    end
  end
end
