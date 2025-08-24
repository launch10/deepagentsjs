# == Schema Information
#
# Table name: account_request_counts
#
#  id            :integer          not null, primary key
#  account_id    :integer          not null
#  request_count :integer          not null
#  month         :timestamptz      not null, primary key
#  created_at    :timestamptz      not null
#
# Indexes
#
#  index_account_request_counts_on_account_id_and_month  (account_id,month)
#  index_account_request_counts_on_account_month         (account_id,month,request_count) UNIQUE
#

class AccountRequestCount < ApplicationRecord
  include Partitionable
  
  belongs_to :account

  validates :account, presence: true
  validates :month, presence: true
  validates :request_count, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :account_id, uniqueness: { scope: :month }

  # Scopes
  scope :for_month, ->(date) { where(month: date.beginning_of_month) }
  scope :current_month, -> { for_month(Date.current) }
  scope :previous_month, -> { for_month(1.month.ago) }
  scope :over_limit, ->(limit) { where('request_count > ?', limit) }
  scope :recent, -> { order(month: :desc) }
  
  # Callbacks
  before_validation :normalize_month
  
  # Get or create the current month's counter for a account
  def self.current_for_account(account)
    find_or_create_by(account: account, month: Date.current.beginning_of_month) do |counter|
      counter.request_count = 0
      counter.created_at = Time.current
    end
  end

  # Override to indicate this table partitions by month, not hour
  def self.partition_by_hour?
    false
  end

  def self.update_accounts(accounts, hour)
    # Group domain request counts by account and sum them
    domain_requests_by_account = DomainRequestCount.where(
      account_id: accounts.map(&:id),
      hour: hour.beginning_of_month..hour.end_of_month
    ).group(:account_id).sum(:request_count)
    
    request_counts = accounts.map do |account|
      account_request_count = AccountRequestCount.find_or_initialize_by(
        account: account, 
        month: hour.beginning_of_month
      )
      account_request_count.request_count = domain_requests_by_account[account.id] || 0
      account_request_count.created_at ||= Time.current
      account_request_count.save!
      account_request_count
    end

    # Check for accounts over limit and trigger blocking if needed
    over_limit, under_limit = request_counts.partition(&:over_limit?)

    over_limit.map(&:account).each do |account|
      Rails.logger.info "[BLOCK] Blocking account #{account.id} for #{account.monthly_request_limit} requests"
      Rails.logger.info "[BLOCK] Blocking account #{account.id} for #{account.monthly_request_limit} requests"
      Rails.logger.info "[BLOCK] Blocking account #{account.id} for #{account.monthly_request_limit} requests"
      Rails.logger.info "[BLOCK] Blocking account #{account.id} for #{account.monthly_request_limit} requests"
      Rails.logger.info "[BLOCK] Blocking account #{account.id} for #{account.monthly_request_limit} requests"
      Rails.logger.info "[BLOCK] Blocking account #{account.id} for #{account.monthly_request_limit} requests"
      Rails.logger.info "[BLOCK] Blocking account #{account.id} for #{account.monthly_request_limit} requests"
      Cloudflare::Firewall.block_account(account)
    end
    under_limit.map(&:account).each do |account|
      Rails.logger.info "[UNBLOCK] Unblocking account #{account.id} for #{account.monthly_request_limit} requests"
      Rails.logger.info "[UNBLOCK] Unblocking account #{account.id} for #{account.monthly_request_limit} requests"
      Rails.logger.info "[UNBLOCK] Unblocking account #{account.id} for #{account.monthly_request_limit} requests"
      Rails.logger.info "[UNBLOCK] Unblocking account #{account.id} for #{account.monthly_request_limit} requests"
      Rails.logger.info "[UNBLOCK] Unblocking account #{account.id} for #{account.monthly_request_limit} requests"
      Cloudflare::Firewall.unblock_account(account)
    end
  end

  # Increment the counter atomically
  def increment_by!(amount)
    with_lock do
      self.request_count += amount
      save!
    end
  end
  
  # Reset the counter (typically at the beginning of a new month)
  def reset!
    update!(request_count: 0)
  end
  
  # Check if account is over their plan limit
  def over_limit?
    request_count > account.monthly_request_limit
  end

  # Get the percentage of limit used
  def usage_percentage
    plan_limit = PlanLimit.find_by(limit_type: 'requests_per_month')
    return 0 unless plan_limit&.limit&.positive?
    
    ((request_count.to_f / plan_limit.limit) * 100).round(2)
  end
  
  # Get remaining requests for the month
  def remaining_requests
    plan_limit = PlanLimit.find_by(limit_type: 'requests_per_month')
    return nil unless plan_limit
    
    [plan_limit.limit - request_count, 0].max
  end
  
  # Class method to get top accounts by usage for a given month
  def self.top_accounts(month: Date.current, limit: 10)
    for_month(month)
      .includes(:account)
      .order(request_count: :desc)
      .limit(limit)
  end
  
  # Class method to find accounts approaching their limits (e.g., > 80% usage)
  def self.approaching_limit(threshold_percentage: 80)
    includes(account: { account: { plan: :plan_limits } })
      .current_month
      .select do |counter|
        counter.usage_percentage >= threshold_percentage
      end
  end
  
  # Monthly report for a account
  def self.monthly_report(account, months_back: 6)
    start_month = months_back.months.ago.beginning_of_month
    
    where(account: account)
      .where('month >= ?', start_month)
      .order(:month)
      .pluck(:month, :request_count)
      .to_h
  end
  
  private
  
  def normalize_month
    self.month = month&.beginning_of_month
  end
  
end
