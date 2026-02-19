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

      # Inject correct basename for subpath deploys
      inject_basename!

      # Generate robots.txt before build (goes into public/ → copied to dist/)
      generate_robots_txt!

      # Run pnpm install and build (includes prerendering)
      unless build_exists?
        system("pnpm install --ignore-workspace", chdir: temp_dir) or raise "pnpm install failed"
        system("pnpm run build", chdir: temp_dir) or raise "pnpm build failed"
      end

      dist_path = File.join(temp_dir, "dist")
      raise "Build failed: dist directory not found" unless Dir.exist?(dist_path)

      # Generate sitemap after build so we can include prerendered routes
      generate_sitemap_xml!

      dist_path
    end

    def build_exists?
      Dir.exist?(File.join(temp_dir, "dist"))
    end

    private

    def write_env_file!
      env_vars = {
        "VITE_SIGNUP_TOKEN" => website.project.signup_token,
        "VITE_API_BASE_URL" => ENV.fetch("DEPLOY_API_BASE_URL", "https://launch10.ai"),
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

    def inject_basename!
      basename = website.website_url&.path || "/"
      return if basename == "/"

      index_path = File.join(temp_dir, "index.html")
      return unless File.exist?(index_path)

      content = File.read(index_path)
      content.gsub!("window.__BASENAME__ = '/';", "window.__BASENAME__ = '#{basename}';")
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

    def generate_robots_txt!
      base_url = website_deploy_domain_url
      return unless base_url

      public_dir = File.join(temp_dir, "public")
      FileUtils.mkdir_p(public_dir)

      content = <<~TXT
        User-agent: *
        Allow: /

        Sitemap: #{base_url}/sitemap.xml
      TXT

      File.write(File.join(public_dir, "robots.txt"), content)
    end

    def generate_sitemap_xml!
      base_url = website_deploy_domain_url
      return unless base_url

      dist_path = File.join(temp_dir, "dist")
      lastmod = website.updated_at.strftime("%Y-%m-%d")

      # Read prerendered routes if available, otherwise fall back to just "/"
      routes = ["/"]
      routes_file = File.join(dist_path, "prerendered-routes.json")
      if File.exist?(routes_file)
        routes = JSON.parse(File.read(routes_file))
      end

      urls = routes.map do |route|
        loc = (route == "/") ? "#{base_url}/" : "#{base_url}#{route}"
        <<~URL
          <url>
            <loc>#{loc}</loc>
            <lastmod>#{lastmod}</lastmod>
          </url>
        URL
      end.join

      content = <<~XML
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        #{urls.strip}
        </urlset>
      XML

      File.write(File.join(dist_path, "sitemap.xml"), content)
    end

    def website_deploy_domain_url
      website.website_url&.full_url&.chomp("/")
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
