require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

abort("The Rails environment is running in production mode!") if Rails.env.production?
require 'rspec/rails'
require 'sidekiq/testing'

Rails.root.glob('spec/support/**/*.rb').sort_by(&:to_s).each { |f| require f }

$memory_cache = ActiveSupport::Cache::MemoryStore.new

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  config.fixture_paths = [
    Rails.root.join('spec/fixtures')
  ]
  config.use_transactional_fixtures = true
  config.include FactoryBot::Syntax::Methods
  
  # Include helper modules for request specs
  config.include JwtHelpers, type: :request
  config.include SubscriptionHelpers, type: :request
  config.include PlanHelpers, type: :request

  config.before(:each, :logsql) do
    ActiveRecord::Base.logger = Logger.new(STDOUT)
  end
  
  config.after(:each) do
    Timecop.return
  end

  config.before(:each) do
    Sidekiq::Worker.clear_all
  end

  config.around(:each, :caching) do |example|
    default_store = Rails.cache
    Rails.cache = $memory_cache
    caching = ActionController::Base.perform_caching
    ActionController::Base.perform_caching = example.metadata[:caching]
    example.run
    Rails.cache.clear
    Rails.cache = default_store
    ActionController::Base.perform_caching = caching
  end

  config.filter_rails_from_backtrace!
  config.filter_run_when_matching :focus
end
