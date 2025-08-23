# == Schema Information
#
# Table name: firewalls
#
#  id                  :integer          not null, primary key
#  user_id             :integer          not null
#  zone_id             :string           not null
#  zone_name           :string           not null
#  status              :string           default("active")
#  has_blocked_domains :boolean          default("false")
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#
# Indexes
#
#  index_firewalls_on_has_blocked_domains  (has_blocked_domains)
#  index_firewalls_on_status               (status)
#  index_firewalls_on_user_id              (user_id)
#  index_firewalls_on_zone_id              (zone_id)
#  index_firewalls_on_zone_id_and_user_id  (zone_id,user_id) UNIQUE
#

class Firewall < ApplicationRecord
  belongs_to :user
  has_many :firewall_rules, dependent: :destroy
  
  validates :user, presence: true
  validates :zone_id, presence: true, uniqueness: { scope: :user_id }
  validates :zone_name, presence: true
  
  scope :active, -> { where(status: 'active') }
  scope :with_blocked_domains, -> { where(has_blocked_domains: true) }
  
  def block_domains(domains_to_block)
    transaction do
      domains_to_block.each do |domain_info|
        # Skip if domain already has a rule
        next if firewall_rules.exists?(domain: domain_info[:domain])
        
        rule = firewall_rules.create!(
          domain: domain_info[:domain],
          request_count: domain_info[:request_count],
          status: 'pending',
          first_seen_at: domain_info[:first_seen_at],
          last_seen_at: domain_info[:last_seen_at],
          reason: domain_info[:reason]
        )
        
        # Enqueue blocking worker
        Cloudflare::BlockWorker.perform_async(rule.id)
      end
      
      # Update firewall status
      update!(has_blocked_domains: true) unless has_blocked_domains
    end
  end
  
  def unblock_all
    blocked_rules = firewall_rules.blocked
    
    blocked_rules.each do |rule|
      Cloudflare::UnblockWorker.perform_async(rule.id)
    end
    
    # Update status if no more blocked rules
    update!(has_blocked_domains: false) if firewall_rules.blocked.empty?
    
    blocked_rules.count
  end
  
  def sync_with_cloudflare
    service = Cloudflare::FirewallService.new(zone_id)
    cloudflare_rules = service.list_rules(fetch_all: true)
    
    cloudflare_rule_ids = cloudflare_rules.map { |r| r['id'] }
    
    # Create local rules for Cloudflare rules not in database
    cloudflare_rules.each do |cf_rule|
      next unless cf_rule['expression']&.include?('http.host eq')
      
      # Extract domain from expression
      domain = cf_rule['expression'].scan(/http\.host eq "([^"]+)"/).flatten.first
      next unless domain
      
      rule = firewall_rules.find_or_initialize_by(domain: domain)
      rule.cloudflare_rule_id = cf_rule['id']
      rule.status = 'blocked' if rule.new_record?
      rule.save!
    end
    
    # Mark orphaned local rules as removed
    firewall_rules.where.not(cloudflare_rule_id: nil)
                  .where.not(cloudflare_rule_id: cloudflare_rule_ids)
                  .update_all(status: 'removed')
  end
  
  def self.monthly_unblock_all
    users_with_blocks = User.joins(:firewalls)
                           .where(firewalls: { has_blocked_domains: true })
                           .distinct
    
    users_with_blocks.each do |user|
      Cloudflare::UnblockWorker::BatchWorker.perform_async(user.id)
    end
    
    users_with_blocks.count
  end
end
