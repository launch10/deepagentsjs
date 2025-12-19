# frozen_string_literal: true

namespace :atlas do
  desc "Sync all models to Atlas (respects CLOUDFLARE_DEPLOY_ENV)"
  task sync: :environment do
    sync_all_models
  end

  namespace :sync do
    desc "Sync all models to Atlas staging environment"
    task staging: :environment do
      with_environment("staging") { sync_all_models }
    end

    desc "Sync all models to Atlas production environment"
    task production: :environment do
      with_environment("production") { sync_all_models }
    end

    desc "Sync all models to Atlas development environment"
    task development: :environment do
      with_environment("development") { sync_all_models }
    end

    desc "Sync all models to Atlas (alias for atlas:sync)"
    task all: :environment do
      sync_all_models
    end

    desc "Sync a specific model to Atlas"
    task :model, [:model_name] => :environment do |_t, args|
      model_name = args[:model_name]
      abort "Usage: bin/rails atlas:sync:model[ModelName]" unless model_name.present?

      model = model_name.constantize
      sync_model(model)
    end
  end

  desc "Show Atlas sync status"
  task status: :environment do
    puts "Atlas Sync Configuration"
    puts "=" * 40
    puts "  Environment: #{Cloudflare.deploy_env}"
    puts "  Sync Enabled: #{Atlas::BaseService.config.allow_sync}"
    puts "  Base URL: #{Atlas::BaseService.config.base_url}"
    puts ""

    if Rails.env.development? || Rails.env.test?
      unless Atlas::BaseService.config.allow_sync
        puts "WARNING: Atlas sync is disabled in #{Rails.env}."
        puts "Set ALLOW_ATLAS_SYNC=true to enable."
      end
    end

    puts ""
    puts "Model counts:"
    [Account, Domain, Plan, Website, WebsiteUrl].each do |model|
      puts "  #{model.name}: #{model.count}"
    end
  end

  def sync_all_models
    environment = Cloudflare.deploy_env
    sync_enabled = Atlas::BaseService.config.allow_sync

    puts "Syncing to Atlas (environment: #{environment}, sync_enabled: #{sync_enabled})"

    if (Rails.env.development? || Rails.env.test?) && !sync_enabled
      abort "Atlas sync is disabled. Set ALLOW_ATLAS_SYNC=true to enable."
    end

    [Account, Domain, Plan, Website, WebsiteUrl].each do |model|
      sync_model(model)
    end

    puts "Done!"
  end

  def sync_model(model)
    puts "Syncing #{model.name}..."
    count = 0
    errors = 0

    model.find_each do |record|
      begin
        record.sync_to_atlas
        count += 1
        print "." if count % 10 == 0
      rescue => e
        errors += 1
        puts "\n  Error syncing #{model.name}##{record.id}: #{e.message}"
      end
    end

    puts "\n  #{count} synced, #{errors} errors"
  end

  def with_environment(env)
    original_deploy_env = Cloudflare.deploy_env
    original_allow_sync = Atlas::BaseService.config.allow_sync

    Cloudflare.deploy_env = env
    Atlas::BaseService.config.allow_sync = true

    puts "Temporarily set environment to: #{env}"

    yield
  ensure
    Cloudflare.deploy_env = original_deploy_env
    Atlas::BaseService.config.allow_sync = original_allow_sync
  end
end
