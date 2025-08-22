module Buildable
  extend ActiveSupport::Concern

  included do
    before_create :validate_website_has_files
    before_create :ensure_snapshot_exists
  end

  def build!
    update!(status: 'building')
    
    FileUtils.mkdir_p(temp_dir)
    
    # Write all website files to disk
    website.files_from_snapshot(snapshot_id).each do |file|
      file_path = File.join(temp_dir, file.path)
      FileUtils.mkdir_p(File.dirname(file_path))
      File.write(file_path, file.content)
    end
    
    # Run pnpm install and build
    unless build_exists?
      Dir.chdir(temp_dir) do
        system("pnpm install") or raise "pnpm install failed"
        system("pnpm build") or raise "pnpm build failed"
      end
    end
    
    dist_path = File.join(temp_dir, 'dist')
    raise "Build failed: dist directory not found" unless Dir.exist?(dist_path)
    
    dist_path
  end

  def build_exists?
    Dir.exist?(File.join(temp_dir, 'dist'))
  end

private

  def validate_website_has_files
    if website.files.empty?
      raise "Cannot deploy website without files"
    end
  end
  
  def ensure_snapshot_exists
    unless website.latest_snapshot.present?
      snapshot = website.snapshot
      self.snapshot_id = snapshot.id
    else
      self.snapshot_id = website.latest_snapshot.id
    end
  end

  def temp_dir
    Rails.root.join("tmp/deploy_#{id}")
  end
end