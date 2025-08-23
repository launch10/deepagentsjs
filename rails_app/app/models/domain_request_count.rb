# == Schema Information
#
# Table name: domain_request_counts
#
#  id            :integer          not null, primary key
#  domain_id     :integer          not null
#  user_id       :integer          not null
#  request_count :integer          not null
#  hour          :timestamptz      not null, primary key
#  created_at    :timestamptz      not null
#
# Indexes
#
#  index_domain_request_counts_on_domain_hour_count     (domain_id,hour,request_count)
#  index_domain_request_counts_on_domain_id_and_hour    (domain_id,hour)
#  index_domain_request_counts_on_user_domain_and_hour  (user_id,domain_id,hour) UNIQUE
#  index_domain_request_counts_on_user_id_and_hour      (user_id,hour)
#

class DomainRequestCount < ApplicationRecord
  include Partitionable 

  belongs_to :domain
  belongs_to :user

  validates :domain, presence: true
  validates :user, presence: true
  validates :request_count, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :domain_id, uniqueness: { scope: [:user_id, :hour] }

  # Scopes for querying
  scope :for_user, ->(user) { where(user: user) }
  scope :for_domain, ->(domain) { where(domain: domain) }
  scope :in_period, ->(start_time, end_time) { where(hour: start_time..end_time) }
  scope :recent, ->(duration = 24.hours) { where('hour >= ?', duration.ago) }
  scope :with_traffic, -> { where('request_count > 0') }

  class << self
    include Domain::NormalizeDomain
  end

  def self.partition_by_hour?
    true
  end

  # Get total requests for a user in a given period
  def self.total_for_user(user, start_time, end_time = Time.current)
    for_user(user).in_period(start_time, end_time).sum(:request_count)
  end
  
  # Get total requests for a domain in a given period
  def self.total_for_domain(domain, start_time, end_time = Time.current)
    for_domain(domain).in_period(start_time, end_time).sum(:request_count)
  end
  
  # Get domains with traffic for a user in the last N hours
  def self.active_domains_for_user(user, hours_ago = 24)
    joins(:domain)
      .for_user(user)
      .recent(hours_ago.hours)
      .with_traffic
      .group('domains.hostname')
      .sum(:request_count)
  end
  
  # Hourly aggregation for analytics
  def self.hourly_breakdown(user: nil, domain: nil, date: Date.current)
    query = self.all
    query = query.for_user(user) if user
    query = query.for_domain(domain) if domain
    
    start_time = date.beginning_of_day
    end_time = date.end_of_day
    
    # Group by hour manually if group_by_hour is not available
    results = {}
    query.in_period(start_time, end_time).find_each do |record|
      hour_key = record.hour.beginning_of_hour
      results[hour_key] ||= 0
      results[hour_key] += record.request_count
    end
    results
  end
  
  # Daily aggregation
  def self.daily_total(user: nil, domain: nil, date: Date.current)
    query = self.all
    query = query.for_user(user) if user
    query = query.for_domain(domain) if domain
    
    query.in_period(date.beginning_of_day, date.end_of_day)
         .sum(:request_count)
  end

  # sample report: {"abeverything.com" => 16, "example.abeverything.com" => 50}
  def self.process_traffic_report(traffic_report: nil, start_time: nil, zone_id: nil)
    raise "Traffic report must be a hash" unless traffic_report.is_a?(Hash)
    raise "Start time must be a time object" unless start_time.is_a?(Time)
    raise "Zone ID must be a string" unless zone_id.is_a?(String)
    
    return if traffic_report.blank?
    
    domain_names = traffic_report.keys.map { |domain| normalize_domain(domain) }
    domains = Domain.where(domain: domain_names).includes(:user)
    domains_by_domain = domains.index_by(&:domain)
    domains.update_all(cloudflare_zone_id: zone_id)
    users = domains.map(&:user).uniq
    summarized_domains = traffic_report.reduce({}) do |summarized_domains, (domain, request_count)|
      summarized_domains.tap do
        summarized_domains[normalize_domain(domain)] ||= 0
        summarized_domains[normalize_domain(domain)] += request_count
      end
    end
    
    to_insert = summarized_domains.map do |domain, request_count|
      # Upsert domain request count for this hour
      domain_record = domains_by_domain[domain]
      if domain_record.blank?
        Rollbar.error("Traffic report found for domain without a domain record", domain: domain)
        next
      end
      
      domain_request_count = DomainRequestCount.find_or_initialize_by(
        domain_id: domain_record.id,
        user_id: domain_record.user_id,
        hour: start_time
      )
      
      domain_request_count.request_count = request_count
      domain_request_count
    end.compact

    return if to_insert.blank?

    # Use raw SQL for upsert to handle composite primary key and SERIAL id properly
    to_insert.each do |record|
      sql = <<-SQL
        INSERT INTO domain_request_counts (domain_id, user_id, hour, request_count, created_at)
        VALUES (#{record.domain_id}, #{record.user_id}, '#{record.hour.to_fs(:db)}', #{record.request_count}, '#{start_time.to_fs(:db)}')
        ON CONFLICT (user_id, domain_id, hour)
        DO UPDATE SET request_count = EXCLUDED.request_count
      SQL
      
      connection.execute(sql)
    end

    # UserRequestCount.update_users(users, start_time)
  end
end
