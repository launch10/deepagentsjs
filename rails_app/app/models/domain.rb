# == Schema Information
#
# Table name: domains
#
#  id                 :bigint           not null, primary key
#  domain             :string
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint
#  cloudflare_zone_id :string
#  website_id         :bigint
#
# Indexes
#
#  index_domains_on_account_id          (account_id)
#  index_domains_on_cloudflare_zone_id  (cloudflare_zone_id)
#  index_domains_on_created_at          (created_at)
#  index_domains_on_domain              (domain)
#  index_domains_on_website_id          (website_id)
#

class Domain < ApplicationRecord
  include Atlas::Domain
  include Cloudflare::Monitorable
  include DomainConcerns::NormalizeDomain

  belongs_to :website, optional: true
  belongs_to :account
  has_many :domain_request_counts, dependent: :destroy
  has_one :firewall_rule, class_name: "Cloudflare::FirewallRule"

  validates :domain, presence: true, uniqueness: true
  validates :account_id, presence: true

  before_validation :set_default_domain, on: :create
  before_validation :set_normalized_domain, on: :create

  def blocked?
    firewall_rule&.blocked? || false
  end

  private

  def set_default_domain
    return if domain.present?
    return unless website

    base_url = ENV.fetch("DEPLOYMENT_BASE_URL", "launch10.ai")
    base_domain = "#{website.name.parameterize}.#{base_url}"

    if self.class.exists?(domain: base_domain)
      # Find all domains matching the pattern and extract numbers
      pattern = "#{website.name.parameterize}%.#{base_url}"
      existing_domains = Domain.where("domain LIKE ?", pattern).pluck(:domain)

      # Extract numbers from domains like test-site1.launch10.ai
      numbers = existing_domains.map do |d|
        match = d.match(/#{Regexp.escape(website.name.parameterize)}(\d+)\.#{Regexp.escape(base_url)}/)
        match ? match[1].to_i : 0
      end

      # Find the next available number
      counter = (numbers.max || 0) + 1
      self.domain = "#{website.name.parameterize}#{counter}.#{base_url}"
    else
      self.domain = base_domain
    end
  end

  def set_normalized_domain
    return if domain.blank?
    write_attribute(:domain, normalize_domain(domain))
  end
end
