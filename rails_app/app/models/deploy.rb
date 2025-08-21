# == Schema Information
#
# Table name: deploys
#
#  id                  :integer          not null, primary key
#  website_id          :integer
#  website_history_id  :integer
#  status              :string           not null
#  trigger             :string           default("manual")
#  stacktrace          :text
#  snapshot_id         :string
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#
# Indexes
#
#  index_deploys_on_created_at          (created_at)
#  index_deploys_on_snapshot_id         (snapshot_id)
#  index_deploys_on_status              (status)
#  index_deploys_on_trigger             (trigger)
#  index_deploys_on_website_history_id  (website_history_id)
#  index_deploys_on_website_id          (website_id)
#

class Deploy < ApplicationRecord
  belongs_to :website

  validates :status, presence: true
  validates :website, presence: true

  before_create :ensure_snapshot_exists
  before_create :validate_website_has_files

  after_initialize :set_default_status

  STATUS = %w[pending building uploading completed failed]
  scope :completed, -> { where(status: 'completed') }
  scope :failed, -> { where(status: 'failed') }
  scope :pending, -> { where(status: 'pending') }
  validates :status, inclusion: { in: STATUS }

  def deploy!
    dist_path = build!
    upload!(dist_path)
    true
  rescue => e
    Rails.logger.error "Deploy failed: #{e.message}"
    false
  ensure
    if dist_path
      FileUtils.rm_rf(dist_path.gsub('/dist', ''))
    end
  end

  def build!
    update!(status: 'building')
    
    temp_dir = "/tmp/deploy_#{id}"
    FileUtils.mkdir_p(temp_dir)
    
    # Write all website files to disk
    website.files_from_snapshot(snapshot_id).each do |file|
      file_path = File.join(temp_dir, file.filename)
      FileUtils.mkdir_p(File.dirname(file_path))
      File.write(file_path, file.content)
    end
    
    # Run pnpm install and build
    Dir.chdir(temp_dir) do
      system("pnpm install") or raise "pnpm install failed"
      system("pnpm build") or raise "pnpm build failed"
    end
    
    dist_path = File.join(temp_dir, 'dist')
    raise "Build failed: dist directory not found" unless Dir.exist?(dist_path)
    
    dist_path
  end

  def upload!(dist_path)
    begin
      update!(status: 'uploading')
      
      # Upload to R2 with timestamp
      timestamp = Time.current.strftime('%Y%m%d%H%M%S')
      r2_path = "#{website.project_id}/#{timestamp}"
      
      uploader = DeployUploader.new
      uploader.store!(dist_path, r2_path)
      
      # Hotswap the live directory
      uploader.hotswap_live(r2_path)
      
      # Mark as completed
      update!(status: 'completed')
    rescue => e
      update!(status: 'failed', stacktrace: e.backtrace.join("\n"))
      raise e
    ensure
      if dist_path
        FileUtils.rm_rf(dist_path.gsub('/dist', ''))
      end
    end
  end

  private

  def set_default_status
    self.status ||= 'pending'
  end

  def ensure_snapshot_exists
    unless website.latest_snapshot
      snapshot = website.snapshot
      self.snapshot_id = snapshot.id
    else
      self.snapshot_id = website.latest_snapshot.id
    end
  end

  def validate_website_has_files
    if website.files.empty?
      raise "Cannot deploy website without files"
    end
  end
end