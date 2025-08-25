class Deploy
  module Deployable
    extend ActiveSupport::Concern
    KEEP_DEPLOY_LIMIT = 5

    included do
      after_initialize :set_default_status
      after_initialize :set_default_environment
      after_create :update_revertible_deploys
    end

    def deploy(async: true)
      if async
        DeployWorker.perform_async(id)
      else
        actually_deploy
      end
    end

    def deploy!
      deploy(async: false)
    end

    def actually_deploy
      later_deploy_exists = Deploy.live.where(website_id: website_id).where("id > ?", id).exists?
      if later_deploy_exists
        update!(status: 'skipped')
        return
      end
      
      dist_path = build!
      upload!(dist_path)
      true
    rescue => e
      Rails.logger.error "Deploy failed: #{e.message} #{e.backtrace}"
      update!(status: 'failed', stacktrace: "#{e.message}\n#{e.backtrace.join("\n")}")
      false
    ensure
      if dist_path
        FileUtils.rm_rf(dist_path.gsub('/dist', ''))
      end
    end

    def upload!(dist_path)
      begin
        update!(status: 'uploading')
        
        # Upload to R2 with timestamp
        timestamp = created_at.strftime('%Y%m%d%H%M%S')
        r2_path = "#{website.id}/#{timestamp}"
        
        uploader = DeployUploader.new(environment: environment)
        
        # Determine target directory based on preview status
        target_dir = is_preview? ? 'preview' : 'live'
        
        if !is_preview?
          # Preserve existing live version if it exists (only for non-preview deploys)
          current_live = website.deploys.where(environment: environment, is_live: true, is_preview: false).first
          if current_live && current_live != self
            uploader.preserve_current_live(website.id, current_live.created_at.strftime('%Y%m%d%H%M%S'))
            current_live.update!(is_live: false)
          end
        end
        
        uploader.store!(dist_path, r2_path)
        
        # Hotswap the appropriate directory (preview or live)
        uploader.hotswap_to_target(r2_path, target_dir)
        
        # Mark as completed and appropriate status
        update!(
          status: 'completed',
          is_live: !is_preview?,
          version_path: r2_path,
          revertible: !is_preview?
        )
        
        # Update revertible status for other deploys (only for non-preview)
        update_revertible_deploys unless is_preview?
        
        # Cleanup old non-revertible deploys from R2 (only for non-preview)
        cleanup_old_deploys(uploader) unless is_preview?
      rescue => e
        update!(status: 'failed', stacktrace: e.backtrace.join("\n"))
        raise e
      end 
    end
    
    def rollback(async: true)
      if async
        RollbackWorker.perform_async(id)
      else
        actually_rollback
      end
    end

    def rollback!
      rollback(async: false)
    end

    def actually_rollback
      raise "Cannot rollback non-completed deploy" unless status == 'completed'
      raise "Cannot rollback preview deploys" if is_preview?
      raise "Cannot rollback non-revertible deploy" unless revertible?
      raise "Cannot roll back any further!" if is_live?
      
      begin
        uploader = DeployUploader.new(environment: environment)
        
        # Mark current live as not live
        current_live = website.deploys.where(environment: environment, is_live: true, is_preview: false).first
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

    def set_default_environment
      self.environment ||= if Rails.env.production?
                            'production'
                          elsif Rails.env.staging?
                            'staging'
                          else
                            'development'
                          end
    end

    def update_revertible_deploys
      # Only keep the last KEEP_DEPLOY_LIMIT completed deploys as revertible per environment
      # Preview deploys are never revertible
      completed_deploys = website.deploys
        .completed
        .where(environment: environment, is_preview: false, is_live: false)
        .order(created_at: :desc)
      
      # Mark the last KEEP_DEPLOY_LIMIT as revertible
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
end