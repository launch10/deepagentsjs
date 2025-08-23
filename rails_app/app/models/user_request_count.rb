# == Schema Information
#
# Table name: user_request_counts
#
#  id            :integer          not null, primary key
#  user_id       :integer          not null
#  request_count :integer          not null
#  month         :timestamptz      not null, primary key
#  created_at    :timestamptz      not null
#
# Indexes
#
#  index_user_request_counts_on_user_id_and_month  (user_id,month)
#  index_user_request_counts_on_user_month         (user_id,month,request_count) UNIQUE
#

class UserRequestCount < ApplicationRecord
  belongs_to :user

  validates :user, presence: true
  validates :month, presence: true
  validates :request_count, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :user_id, uniqueness: { scope: :month }

  # Scopes
  scope :for_month, ->(date) { where(month: date.beginning_of_month) }
  scope :current_month, -> { for_month(Date.current) }
  scope :previous_month, -> { for_month(1.month.ago) }
  scope :over_limit, ->(limit) { where('request_count > ?', limit) }
  scope :recent, -> { order(month: :desc) }
  
  # Callbacks
  before_validation :normalize_month
  
  # Get or create the current month's counter for a user
  def self.current_for_user(user)
    find_or_create_by(user: user, month: Date.current.beginning_of_month) do |counter|
      counter.request_count = 0
      counter.created_at = Time.current
    end
  end

  def self.create_partitions(num_months)
    num_months.times do |i|
      start_time = (Date.current + i.months).beginning_of_month
      end_time = start_time + 1.month
      partition_name = "user_request_counts_#{start_time.strftime('%Y_%m')}"
      
      ActiveRecord::Base.connection.execute <<-SQL
        CREATE TABLE IF NOT EXISTS #{partition_name} 
        PARTITION OF user_request_counts 
        FOR VALUES FROM ('#{start_time.to_fs(:db)}') TO ('#{end_time.to_fs(:db)}');
      SQL
    end
  end

  def self.update_users(users, hour)
    # Group domain request counts by user and sum them
    domain_requests_by_user = DomainRequestCount.where(
      user_id: users.map(&:id),
      hour: hour.beginning_of_month..hour.end_of_month
    ).group(:user_id).sum(:request_count)
    
    request_counts = users.map do |user|
      user_request_count = UserRequestCount.find_or_initialize_by(
        user: user, 
        month: hour.beginning_of_month
      )
      user_request_count.request_count = domain_requests_by_user[user.id] || 0
      user_request_count.created_at ||= Time.current
      user_request_count.save!
      user_request_count
    end

    over_limit, under_limit = request_counts.partition(&:over_limit?)
    over_limit.each do |user_request_count|
      Cloudflare::Firewall.block_domains(user_request_count.user)
    end
    under_limit.each do |user_request_count|
      Cloudflare::Firewall.unblock_domains(user_request_count.user)
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
  
  # Check if user is over their plan limit
  def over_limit?
    plan_limit = user.account.plan&.plan_limits&.find_by(limit_type: 'requests_per_month')
    return false unless plan_limit

    request_count > plan_limit.limit
  end

  # Get the percentage of limit used
  def usage_percentage
    plan_limit = user.account.plan&.plan_limits&.find_by(limit_type: 'requests_per_month')
    return 0 unless plan_limit&.limit&.positive?
    
    ((request_count.to_f / plan_limit.limit) * 100).round(2)
  end
  
  # Get remaining requests for the month
  def remaining_requests
    plan_limit = user.account.plan&.plan_limits&.find_by(limit_type: 'requests_per_month')
    return nil unless plan_limit
    
    [plan_limit.limit - request_count, 0].max
  end
  
  # Class method to get top users by usage for a given month
  def self.top_users(month: Date.current, limit: 10)
    for_month(month)
      .includes(:user)
      .order(request_count: :desc)
      .limit(limit)
  end
  
  # Class method to find users approaching their limits (e.g., > 80% usage)
  def self.approaching_limit(threshold_percentage: 80)
    includes(user: { account: { plan: :plan_limits } })
      .current_month
      .select do |counter|
        counter.usage_percentage >= threshold_percentage
      end
  end
  
  # Monthly report for a user
  def self.monthly_report(user, months_back: 6)
    start_month = months_back.months.ago.beginning_of_month
    
    where(user: user)
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
