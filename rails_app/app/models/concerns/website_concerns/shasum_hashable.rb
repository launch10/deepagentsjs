module WebsiteConcerns
  module ShasumHashable
    extend ActiveSupport::Concern

    def generate_shasum
      Digest::SHA256.hexdigest(
        website_files.reload.sort_by(&:path).map(&:generate_shasum).join
      )
    end

    def files_changed?
      current_shasum = generate_shasum

      # Check against the latest deploy that actually pushed files (has version_path).
      # Deploys without version_path are no-ops that never uploaded to Cloudflare.
      latest_deploy = deploys.completed.where.not(version_path: nil).order(created_at: :desc).first
      return true unless latest_deploy&.shasum

      current_shasum != latest_deploy.shasum
    end
  end
end
