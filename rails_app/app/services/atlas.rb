# frozen_string_literal: true
module Atlas
  def self.configure(&block)
    BaseService.configure(&block)
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
end