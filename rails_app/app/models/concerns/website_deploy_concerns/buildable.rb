module WebsiteDeployConcerns
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

      # Write environment variables for Vite build
      write_env_file!

      # Inject Google Ads gtag.js script if configured
      inject_gtag_script!

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

    def write_env_file!
      env_vars = {
        "VITE_SIGNUP_TOKEN" => website.project.signup_token,
        "VITE_API_BASE_URL" => Rails.configuration.x.api_base_url,
        "VITE_GOOGLE_ADS_SEND_TO" => google_send_to
      }
      File.write(File.join(temp_dir, ".env"), env_vars.compact.map { |k, v| "#{k}=#{v}" }.join("\n"))
    end

    def inject_gtag_script!
      return unless google_send_to.present?

      index_path = File.join(temp_dir, "index.html")
      return unless File.exist?(index_path)

      content = File.read(index_path)

      gtag_script = <<~HTML
        <!-- Google tag (gtag.js) -->
        <script async src="https://www.googletagmanager.com/gtag/js?id=#{google_conversion_id}"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '#{google_conversion_id}');
        </script>
      HTML

      content.sub!("</head>", "#{gtag_script}</head>")
      File.write(index_path, content)
    end

    def google_conversion_id
      ads_account&.google_conversion_id
    end

    def google_send_to
      ads_account&.google_send_to
    end

    def ads_account
      @ads_account ||= website.project.account.ads_accounts.find_by(platform: "google")
    end

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
