# frozen_string_literal: true

module Atlas
  def self.configure(&)
    BaseService.configure(&)
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
