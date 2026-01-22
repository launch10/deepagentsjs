# Builds the tracking-test website using the REAL Buildable pipeline for E2E testing.
#
# This creates actual database records (Account, Project, Website, WebsiteDeploy)
# and calls the real WebsiteDeploy#build! method to exercise the full build pipeline
# including env var injection, gtag script injection, etc.
#
class TrackingTestBuilder
  EXAMPLE_DIR = Rails.root.join("../shared/websites/examples/tracking-test")
  BUILD_DIR = Rails.root.join("tmp/tracking-test-dist")
  PROJECT_NAME = "Tracking Test Project"
  GOOGLE_CONVERSION_ID = "AW-TEST123"
  GOOGLE_CONVERSION_LABEL = "testLabel"

  class << self
    def build!
      puts "[TrackingTestBuilder] Building tracking-test website using REAL Buildable pipeline..."

      clean!
      FileUtils.mkdir_p(BUILD_DIR)

      # Set up API base URL for the build
      Rails.configuration.x.api_base_url = ENV.fetch("RAILS_TEST_API_URL", "http://localhost:3001")

      # Create database records needed for the build
      website = create_test_records!

      # Create a snapshot (required for WebsiteDeploy to access files via current_history)
      website.snapshot

      # Create deploy and run the REAL Buildable pipeline
      deploy = website.deploys.create!(status: "pending", environment: "development")

      # Clean the deploy's temp directory to ensure fresh build
      # (The Buildable concern skips pnpm build if dist already exists from a previous run)
      deploy_temp_dir = File.join(Dir.tmpdir, "launch10_deploy_#{deploy.id}")
      FileUtils.rm_rf(deploy_temp_dir)

      dist_path = deploy.build!

      # Copy built files to final location
      FileUtils.cp_r(dist_path + "/.", BUILD_DIR)

      # Write project ID to a file so global-setup can verify database records match
      File.write(File.join(BUILD_DIR, ".project-id"), website.project.id.to_s)

      puts "[TrackingTestBuilder] Build complete: #{BUILD_DIR}"
      puts "[TrackingTestBuilder] Website ID: #{website.id}, Project ID: #{website.project.id}"
    end

    def clean!
      FileUtils.rm_rf(BUILD_DIR)
    end

    def build_exists?
      Dir.exist?(BUILD_DIR) && File.exist?(File.join(BUILD_DIR, "index.html"))
    end

    def dist_path
      BUILD_DIR.to_s
    end

    # Returns the Website record used for testing (creates if needed)
    def test_website
      Website.joins(:project).find_by(projects: {name: PROJECT_NAME})
    end

    # Returns the signup token for the test project (for E2E tests to use)
    def signup_token
      test_website&.project&.signup_token
    end

    private

    def create_test_records!
      # Sync the tracking library from the default template to database
      template = TemplateSyncer.sync!("tracking-test", only: ["src/lib/tracking.ts"], dir: "default")

      # Find or create user (required for account ownership)
      user = User.find_or_create_by!(email: "tracking-test@example.com") do |u|
        u.first_name = "Tracking"
        u.last_name = "Test"
        u.password = SecureRandom.hex(16)
        u.terms_of_service = true
      end

      # Find or create account
      account = Account.find_or_create_by!(name: "Tracking Test Account") do |a|
        a.personal = false
        a.owner = user
      end

      # Ensure account has an AdsAccount with Google conversion tracking configured
      ads_account = account.ads_accounts.find_or_create_by!(platform: "google") do |aa|
        aa.google_customer_id = "1234567890"
      end
      ads_account.update!(
        google_conversion_id: GOOGLE_CONVERSION_ID,
        google_conversion_label: GOOGLE_CONVERSION_LABEL
      )

      # Find or create project
      # Note: signup_token is generated via signed_id, not stored in DB
      project = Project.find_or_create_by!(name: "Tracking Test Project", account: account)

      # Find or create website
      website = Website.find_or_create_by!(project: project) do |w|
        w.name = "Tracking Test Website"
        w.account = account
        w.template_id = template.id
      end

      # Load files from example directory into WebsiteFiles
      load_files_into_website!(website)

      website
    end

    def load_files_into_website!(website)
      # Clear existing files to ensure fresh state
      website.website_files.destroy_all

      # Load all files from example directory
      Dir.glob(File.join(EXAMPLE_DIR, "**", "*"), File::FNM_DOTMATCH).each do |src|
        next if src.include?("node_modules")
        next if src.include?(".env")
        next if src.include?("/dist/")
        next if src.include?("/.git")
        next if src.include?("/public/") # Skip public dir (handled separately if needed)
        next if File.directory?(src) && !File.symlink?(src)

        relative = src.sub("#{EXAMPLE_DIR}/", "")
        next if relative.start_with?(".")  # Skip hidden files at root

        # Read content (dereference symlinks)
        content = if File.symlink?(src)
          File.read(File.realpath(src))
        else
          File.read(src)
        end

        website.website_files.create!(
          path: relative,
          content: content
        )
      end

      puts "[TrackingTestBuilder] Loaded #{website.website_files.count} files into website"
    end
  end
end
