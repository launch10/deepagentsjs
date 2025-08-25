module WebsiteConcerns
  module ShasumHashable
    extend ActiveSupport::Concern

    def generate_shasum
      # Generate a shasum based on all file shasums
      # Force reload of associations to get latest data
      website_files.reload if website_files.loaded?
      template_files.reload if template.present? && template_files.loaded?

      file_shasums = files.sort_by(&:path).map do |file|
        # Ensure file has current data if it's persisted
        file = file.class.find(file.id) if file.persisted? && file.changed?
        (file.respond_to?(:shasum) && file.shasum.present?) ? file.shasum : file.generate_shasum
      end
      Digest::SHA256.hexdigest(file_shasums.join)
    end

    def files_changed?
      current_shasum = generate_shasum

      # Check against the latest deploy's shasum
      latest_deploy = deploys.completed.order(created_at: :desc).first
      return true unless latest_deploy&.shasum

      current_shasum != latest_deploy.shasum
    end
  end
end
