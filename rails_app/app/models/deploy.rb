# == Schema Information
#
# Table name: deploys
#
#  id                 :integer          not null, primary key
#  website_id         :integer
#  website_history_id :integer
#  status             :string           not null
#  trigger            :string           default("manual")
#  stacktrace         :text
#  snapshot_id        :string
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  is_live            :boolean          default("false")
#  revertible         :boolean          default("false")
#  version_path       :string
#
# Indexes
#
#  index_deploys_on_created_at              (created_at)
#  index_deploys_on_is_live                 (is_live)
#  index_deploys_on_revertible              (revertible)
#  index_deploys_on_snapshot_id             (snapshot_id)
#  index_deploys_on_status                  (status)
#  index_deploys_on_trigger                 (trigger)
#  index_deploys_on_website_history_id      (website_history_id)
#  index_deploys_on_website_id              (website_id)
#  index_deploys_on_website_id_and_is_live  (website_id,is_live)
#

class Deploy < ApplicationRecord
  KEEP_DEPLOY_LIMIT = 5

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
  scope :live, -> { where(is_live: true) }
  scope :revertible, -> { where(revertible: true) }
  validates :status, inclusion: { in: STATUS }
  
  after_create :update_revertible_deploys

  def deploy!
    dist_path = build!
    upload!(dist_path)
    true
  rescue => e
    Rails.logger.error "Deploy failed: #{e.message} #{e.backtrace}"
    false
  ensure
    if dist_path
      FileUtils.rm_rf(dist_path.gsub('/dist', ''))
    end
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

  def temp_dir
    Rails.root.join("tmp/deploy_#{id}")
  end

  def build_exists?
    Dir.exist?(File.join(temp_dir, 'dist'))
  end

  def upload!(dist_path)
    begin
      update!(status: 'uploading')
      
      # Upload to R2 with timestamp
      timestamp = created_at.strftime('%Y%m%d%H%M%S')
      r2_path = "#{website.id}/#{timestamp}"
      
      uploader = DeployUploader.new
      
      # Preserve existing live version if it exists
      current_live = website.deploys.live.first
      if current_live && current_live != self
        uploader.preserve_current_live(website.id, current_live.created_at.strftime('%Y%m%d%H%M%S'))
        current_live.update!(is_live: false)
      end
      
      uploader.store!(dist_path, r2_path)
      
      # Hotswap the live directory
      uploader.hotswap_live(r2_path)
      
      # Mark as completed and live
      update!(
        status: 'completed',
        is_live: true,
        version_path: r2_path,
        revertible: true
      )
      
      # Update revertible status for other deploys
      update_revertible_deploys
      
      # Cleanup old non-revertible deploys from R2
      cleanup_old_deploys(uploader)
    rescue => e
      update!(status: 'failed', stacktrace: e.backtrace.join("\n"))
      raise e
    ensure
      if dist_path
        FileUtils.rm_rf(dist_path.gsub('/dist', ''))
      end
    end
  end
  
  def rollback!
    raise "Cannot rollback non-completed deploy" unless status == 'completed'
    raise "Cannot rollback non-revertible deploy" unless revertible?
    raise "Cannot roll back any further!" if is_live?
    
    begin
      uploader = DeployUploader.new
      
      # Mark current live as not live
      current_live = website.deploys.live.first
      if current_live && current_live != self
        uploader.preserve_current_live(website.id, current_live.created_at.strftime('%Y%m%d%H%M%S'))
        current_live.update!(is_live: false)
      end
      
      # Hotswap to this version
      uploader.hotswap_live(version_path)
      
      # Mark this as live
      update!(is_live: true)
      
      # Update revertible status
      update_revertible_deploys
      
      true
    rescue => e
      Rails.logger.error "Rollback failed: #{e.message}"
      false
    end
  end

  private

  def set_default_status
    self.status ||= 'pending'
  end

  def ensure_snapshot_exists
    unless website.latest_snapshot.present?
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
  
  def update_revertible_deploys
    # Only keep the last 3 completed deploys as revertible
    completed_deploys = website.deploys.completed.order(created_at: :desc).where(is_live: false)
    
    # Mark the last 3 as revertible
    completed_deploys.limit(KEEP_DEPLOY_LIMIT).update_all(revertible: true)
    
    # Mark all others as not revertible
    if completed_deploys.count > KEEP_DEPLOY_LIMIT
      completed_deploys.offset(KEEP_DEPLOY_LIMIT).update_all(revertible: false)
    end
  end
  
  def cleanup_old_deploys(uploader)
    # Get all deploys that should be kept (revertible + current live)
    keep_deploys = website.deploys.where('revertible = ? OR is_live = ?', true, true)
    
    # Extract timestamps to keep
    keep_timestamps = keep_deploys.map do |deploy|
      next unless deploy.version_path.present?
      # Extract timestamp from version_path (e.g., "project_id/20240101120000")
      deploy.version_path.split('/').last
    end.compact
    
    # Add current deploy's timestamp
    keep_timestamps << created_at.strftime('%Y%m%d%H%M%S')
    
    Rails.logger.info "Keeping #{keep_timestamps.length} deploy timestamps for cleanup"
    
    # Run cleanup
    uploader.cleanup_old_deploys(website.id.to_s, keep_timestamps)
  end
end
