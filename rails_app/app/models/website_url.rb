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

  before_validation :set_default_path
  before_validation :set_account_from_website, if: -> { website.present? && account_id.blank? }

  delegate :domain, to: :domain, prefix: :domain_string, allow_nil: true

  def domain_string
    domain&.domain
  end

  private

  def set_default_path
    self.path ||= "/"
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
