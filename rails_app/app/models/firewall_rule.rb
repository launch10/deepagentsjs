# == Schema Information
#
# Table name: firewall_rules
#
#  id                 :integer          not null, primary key
#  firewall_id        :integer          not null
#  domain             :string           not null
#  status             :string           default("pending"), not null
#  cloudflare_rule_id :string
#  request_count      :integer          default("0")
#  first_seen_at      :datetime
#  last_seen_at       :datetime
#  blocked_at         :datetime
#  unblocked_at       :datetime
#  last_attempted_at  :datetime
#  reason             :text
#  last_error         :text
#  error_count        :integer          default("0")
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#
# Indexes
#
#  index_firewall_rules_on_blocked_at               (blocked_at)
#  index_firewall_rules_on_cloudflare_rule_id       (cloudflare_rule_id)
#  index_firewall_rules_on_domain                   (domain)
#  index_firewall_rules_on_error_count              (error_count)
#  index_firewall_rules_on_firewall_id              (firewall_id)
#  index_firewall_rules_on_firewall_id_and_domain   (firewall_id,domain) UNIQUE
#  index_firewall_rules_on_status                   (status)
#  index_firewall_rules_on_status_and_last_attempt  (status,last_attempted_at)
#  index_firewall_rules_on_unblocked_at             (unblocked_at)
#

class FirewallRule < ApplicationRecord
  class InvalidStateError < StandardError; end
  
  belongs_to :firewall
  has_one :user, through: :firewall
  
  validates :firewall, presence: true
  validates :domain, presence: true, uniqueness: { scope: :firewall_id }
  validates :status, presence: true, inclusion: { in: %w[pending blocking blocked unblocking unblocked failed removed] }
  
  scope :pending, -> { where(status: 'pending') }
  scope :blocking, -> { where(status: 'blocking') }
  scope :blocked, -> { where(status: 'blocked') }
  scope :unblocking, -> { where(status: 'unblocking') }
  scope :unblocked, -> { where(status: 'unblocked') }
  scope :failed, -> { where(status: 'failed') }
  scope :active, -> { where(status: ['blocking', 'blocked']) }
  scope :needs_retry, -> {
    failed.where('last_attempted_at IS NULL OR last_attempted_at < ?', 1.hour.ago)
          .where('error_count < ?', 10)
  }
  
  after_update :update_firewall_status
  
  def block!(cloudflare_rule_id)
    return if status == 'blocked' && self.cloudflare_rule_id.present?
    
    update!(
      status: 'blocked',
      cloudflare_rule_id: cloudflare_rule_id,
      blocked_at: Time.current,
      last_error: nil,
      error_count: 0
    )
  end
  
  def unblock!
    raise InvalidStateError, "Cannot unblock rule that is not blocked (status: #{status})" unless status == 'blocked'
    
    update!(
      status: 'unblocked',
      cloudflare_rule_id: nil,
      unblocked_at: Time.current
    )
  end
  
  def mark_failed!(error_message)
    self.status = 'failed'
    self.last_error = error_message
    self.error_count = (error_count || 0) + 1
    self.last_attempted_at = Time.current
    save!
  end
  
  def retry!(operation)
    raise ArgumentError, "Invalid operation: #{operation}" unless [:block, :unblock].include?(operation)
    raise InvalidStateError, "Can only retry failed rules (status: #{status})" unless status == 'failed'
    
    case operation
    when :block
      update!(status: 'blocking')
      Cloudflare::BlockWorker.perform_async(id)
    when :unblock
      update!(status: 'unblocking')
      Cloudflare::UnblockWorker.perform_async(id)
    end
  end
  
  def can_retry?
    return false unless status == 'failed'
    return false if error_count >= 10
    return true if last_attempted_at.nil?
    
    last_attempted_at < 1.hour.ago
  end
  
  def build_cloudflare_expression
    "(http.host eq \"#{domain.gsub('"', '\"')}\")"
  end
  
  private
  
  def update_firewall_status
    return unless saved_change_to_status?
    
    if firewall.firewall_rules.blocked.any?
      firewall.update_columns(has_blocked_domains: true) unless firewall.has_blocked_domains
    else
      firewall.update_columns(has_blocked_domains: false) if firewall.has_blocked_domains
    end
  end
end
