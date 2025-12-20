# == Schema Information
#
# Table name: website_urls
#
#  id         :bigint           not null, primary key
#  path       :string           default("/"), not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint           not null
#  domain_id  :bigint           not null
#  website_id :bigint           not null
#
# Indexes
#
#  index_website_urls_on_account_id          (account_id)
#  index_website_urls_on_domain_id           (domain_id)
#  index_website_urls_on_domain_id_and_path  (domain_id,path) UNIQUE
#  index_website_urls_on_website_id          (website_id)
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#  fk_rails_...  (domain_id => domains.id)
#  fk_rails_...  (website_id => websites.id)
#
# WebsiteUrl maps a website to a specific domain + path combination.
#
# == Path Restrictions (Single-Level Only)
#
# Paths are restricted to single-level nesting (e.g., "/bingo", "/pricing") and cannot
# have multiple segments (e.g., "/marketing/campaign" is NOT allowed).
#
# This restriction exists because of how React Router's BrowserRouter works with the
# `basename` prop. When a site is deployed to a subpath like "/bingo", the React app
# needs to know its base path so that:
#
#   1. Internal routes like "/pricing" resolve correctly to "/bingo/pricing"
#   2. Direct navigation to "/bingo/pricing" works (bookmark, refresh, shared link)
#
# The base template (templates/default/index.html) detects the basename at runtime:
#
#   <script>
#     window.__BASENAME__ = '/' + (window.location.pathname.split('/')[1] || '');
#   </script>
#
# This extracts only the FIRST path segment. For example:
#   - "/" → __BASENAME__ = "/"
#   - "/bingo" → __BASENAME__ = "/bingo"
#   - "/bingo/" → __BASENAME__ = "/bingo"
#   - "/bingo/pricing" → __BASENAME__ = "/bingo"
#
# The App.tsx then uses this:
#
#   <BrowserRouter basename={window.__BASENAME__ || '/'}>
#
# If we allowed multi-level paths like "/marketing/campaign", visiting
# "/marketing/campaign/pricing" would incorrectly set __BASENAME__ to "/marketing"
# instead of "/marketing/campaign", breaking all routing.
#
# To support multi-level paths in the future, we would need to inject the basename
# at build time (when Rails knows the full WebsiteUrl path) rather than detecting
# it at runtime in the browser.
#
class WebsiteUrl < ApplicationRecord
  include Atlas::WebsiteUrl

  belongs_to :website
  belongs_to :domain
  belongs_to :account

  validates :path, presence: true
  validates :account_id, presence: true
  validates :website_id, presence: true
  validates :domain_id, presence: true
  validate :unique_domain_and_path
  validate :domain_belongs_to_account
  validate :website_belongs_to_account
  validate :path_is_single_level

  before_validation :set_default_path
  before_validation :normalize_path
  before_validation :set_account_from_website, if: -> { website.present? && account_id.blank? }

  delegate :domain, to: :domain, prefix: :domain_string, allow_nil: true

  def domain_string
    domain&.domain
  end

  def to_api_json
    {
      id: id,
      path: path,
      account_id: account_id,
      website_id: website_id,
      domain_id: domain_id,
      domain_string: domain_string,
      created_at: created_at.iso8601,
      updated_at: updated_at.iso8601
    }
  end

  private

  def set_default_path
    self.path ||= "/"
  end

  def normalize_path
    return if path.blank?

    self.path = "/#{path}" unless path.start_with?("/")
    self.path = path.chomp("/") unless path == "/"
  end

  def path_is_single_level
    return if path.blank? || path == "/"

    normalized = path.start_with?("/") ? path[1..] : path
    if normalized.include?("/")
      errors.add(:path, "must be single-level (e.g., '/bingo'), multi-level paths like '/marketing/campaign' are not supported")
    end
  end

  def set_account_from_website
    self.account_id = website.account_id
  end

  def unique_domain_and_path
    return if domain_id.blank? || path.blank?

    existing = WebsiteUrl.where(domain_id: domain_id, path: path)
    existing = existing.where.not(id: id) if persisted?

    if existing.exists?
      errors.add(:base, "A website URL with this domain and path already exists")
    end
  end

  def domain_belongs_to_account
    return if domain.blank? || account_id.blank?

    if domain.account_id != account_id
      errors.add(:domain, "must belong to the account")
    end
  end

  def website_belongs_to_account
    return if website.blank? || account_id.blank?

    if website.account_id != account_id
      errors.add(:website, "must belong to the account")
    end
  end
end
