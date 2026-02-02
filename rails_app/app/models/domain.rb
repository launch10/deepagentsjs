# == Schema Information
#
# Table name: domains
#
#  id                      :bigint           not null, primary key
#  deleted_at              :datetime
#  dns_error_message       :string
#  dns_last_checked_at     :datetime
#  dns_verification_status :string
#  domain                  :string
#  is_platform_subdomain   :boolean          default(FALSE), not null
#  created_at              :datetime         not null
#  updated_at              :datetime         not null
#  account_id              :bigint
#  cloudflare_zone_id      :string
#
# Indexes
#
#  index_domains_on_account_id                         (account_id)
#  index_domains_on_account_id_and_platform_subdomain  (account_id,is_platform_subdomain)
#  index_domains_on_cloudflare_zone_id                 (cloudflare_zone_id)
#  index_domains_on_created_at                         (created_at)
#  index_domains_on_deleted_at                         (deleted_at)
#  index_domains_on_dns_last_checked_at                (dns_last_checked_at)
#  index_domains_on_dns_verification_status            (dns_verification_status)
#  index_domains_on_domain                             (domain)
#

class Domain < ApplicationRecord
  acts_as_paranoid

  RESTRICTED_DOMAINS = [
    "uploads",
    "dev-uploads",
    "staging",
    "www"
  ].map { |d| "#{d}.launch10.ai" }.freeze

  VERIFICATION_STATUSES = %w[pending verified failed].freeze

  include Atlas::Domain
  include Cloudflare::Monitorable
  include DomainConcerns::NormalizeDomain
  include DomainConcerns::Serialization

  acts_as_tenant :account

  belongs_to :account
  has_many :domain_request_counts, dependent: :destroy
  has_many :website_urls, dependent: :destroy
  has_one :firewall_rule, class_name: "Cloudflare::FirewallRule"

  validates :domain, presence: true, uniqueness: true
  validates :account_id, presence: true
  validates :dns_verification_status, inclusion: {in: VERIFICATION_STATUSES}, allow_nil: true

  before_validation :set_normalized_domain, on: :create
  before_validation :set_is_platform_subdomain
  validate :domain_not_restricted
  validate :within_subdomain_limit, on: :create

  scope :platform_subdomains, -> { where(is_platform_subdomain: true) }
  scope :unverified_custom_domains, -> {
    where(is_platform_subdomain: false)
      .where(dns_verification_status: [nil, "pending", "failed"])
  }
  scope :stale_unverified, ->(grace_period_days: 7) {
    unverified_custom_domains
      .where("created_at < ?", grace_period_days.days.ago)
  }

  alias_attribute :platform_subdomain?, :is_platform_subdomain

  def requires_dns_verification?
    !is_platform_subdomain && dns_verification_status != "verified"
  end

  def dns_verified?
    dns_verification_status == "verified"
  end

  def blocked?
    firewall_rule&.blocked? || false
  end

  # Permanently releases this domain, making it available for anyone to claim again.
  #
  # This method:
  # - Hard deletes the domain and associated website_urls from the database
  # - Triggers Atlas sync to remove from Cloudflare (via before_destroy callbacks)
  # - Frees up the subdomain slot for platform subdomains (count-based limit check)
  #
  # Use this for cleaning up stale/unverified domains or when a user explicitly
  # wants to release a domain.
  def release!
    really_destroy!
  end

  private

  def set_normalized_domain
    return if domain.blank?
    write_attribute(:domain, normalize_domain(domain))
  end

  def set_is_platform_subdomain
    return if domain.blank?
    self.is_platform_subdomain = domain.end_with?(".launch10.site")
  end

  def domain_not_restricted
    return if RESTRICTED_DOMAINS.exclude?(domain)
    errors.add(:domain, "is restricted")
  end

  def within_subdomain_limit
    return unless is_platform_subdomain
    return unless account

    limit = subdomain_limit
    return if limit.nil? || limit == 0

    current_count = account.domains.platform_subdomains.count
    return if current_count < limit

    errors.add(:base, "You have reached the maximum number of platform subdomains for your plan")
  end

  def subdomain_limit
    account.plan&.limit_for("platform_subdomains")
  end
end
