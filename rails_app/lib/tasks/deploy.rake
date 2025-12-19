# frozen_string_literal: true

namespace :deploy do
  desc "Deploy a specific website to Cloudflare R2"
  task :website, [:website_id] => :environment do |_t, args|
    website_id = args[:website_id]
    abort "Usage: bin/rails deploy:website[website_id]" unless website_id.present?

    website = Website.find(website_id)
    environment = Cloudflare.deploy_env

    puts "Deploying website #{website.id} to #{environment}..."
    deploy = website.deploy(async: false, environment: environment)

    if deploy.completed?
      puts "Deploy completed successfully!"
      puts "  Status: #{deploy.status}"
      puts "  Environment: #{deploy.environment}"
      puts "  Version: #{deploy.version_path}"
    else
      puts "Deploy failed: #{deploy.status}"
      puts "  Error: #{deploy.error_message}" if deploy.respond_to?(:error_message)
    end
  end

  desc "Deploy all websites to Cloudflare R2"
  task all: :environment do
    environment = Cloudflare.deploy_env
    websites = Website.all

    puts "Deploying #{websites.count} websites to #{environment}..."

    websites.find_each do |website|
      print "  #{website.id}... "
      begin
        deploy = website.deploy(async: false, environment: environment)
        puts deploy.completed? ? "OK" : "FAILED (#{deploy.status})"
      rescue => e
        puts "ERROR: #{e.message}"
      end
    end

    puts "Done!"
  end

  desc "Create a preview deploy for a specific website"
  task :preview, [:website_id] => :environment do |_t, args|
    website_id = args[:website_id]
    abort "Usage: bin/rails deploy:preview[website_id]" unless website_id.present?

    website = Website.find(website_id)
    environment = Cloudflare.deploy_env

    puts "Creating preview deploy for website #{website.id} in #{environment}..."
    deploy = website.preview(async: false, environment: environment)

    if deploy.completed?
      puts "Preview deploy completed successfully!"
      puts "  Status: #{deploy.status}"
      puts "  Environment: #{deploy.environment}"
      puts "  Version: #{deploy.version_path}"
    else
      puts "Preview deploy failed: #{deploy.status}"
    end
  end

  desc "Show current deploy environment configuration"
  task status: :environment do
    puts "Deploy Configuration"
    puts "=" * 40
    puts "  CLOUDFLARE_DEPLOY_ENV: #{Cloudflare.deploy_env}"
    puts "  ALLOW_ATLAS_SYNC: #{Atlas::BaseService.config.allow_sync}"
    puts "  ATLAS_BASE_URL: #{Atlas::BaseService.config.base_url}"
    puts "  R2 Bucket: #{Cloudflare.deploys_bucket}"
    puts ""
    puts "To deploy to staging:"
    puts "  CLOUDFLARE_DEPLOY_ENV=staging bin/rails deploy:website[id]"
    puts ""
    puts "To sync metadata to staging Atlas:"
    puts "  CLOUDFLARE_DEPLOY_ENV=staging ALLOW_ATLAS_SYNC=true bin/rails atlas:sync:all"
  end
end
