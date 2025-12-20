# frozen_string_literal: true

module Atlas
  include ActiveSupport::Configurable

  config_accessor :base_url
  config_accessor :api_secret
  config_accessor :timeout, default: 30
  config_accessor :allow_sync, default: false

  def self.configure(&)
    yield config if block_given?
    BaseService.configure do |base_config|
      base_config.base_url = config.base_url
      base_config.api_secret = config.api_secret
      base_config.timeout = config.timeout
      base_config.allow_sync = config.allow_sync
    end
  end

  def self.accounts
    @accounts ||= AccountService.new
  end

  def self.websites
    @websites ||= WebsiteService.new
  end

  def self.domains
    @domains ||= DomainService.new
  end

  def self.plans
    @plans ||= PlanService.new
  end

  def self.website_urls
    @website_urls ||= WebsiteUrlService.new
  end
end
