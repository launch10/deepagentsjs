# == Schema Information
#
# Table name: leads
#
#  id         :bigint           not null, primary key
#  email      :string(255)      not null
#  name       :string(255)
#  phone      :string(50)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint           not null
#
# Indexes
#
#  index_leads_on_account_id            (account_id)
#  index_leads_on_account_id_and_email  (account_id,email) UNIQUE
#  index_leads_on_email                 (email)
#

class Lead < ApplicationRecord
  acts_as_tenant :account

  belongs_to :account
  has_many :website_leads, dependent: :destroy
  has_many :websites, through: :website_leads

  validates :email, presence: true,
    length: { maximum: 255 },
    format: { with: URI::MailTo::EMAIL_REGEXP },
    uniqueness: { scope: :account_id, case_sensitive: false }
  validates :name, length: { maximum: 255 }, allow_blank: true
  validates :phone, length: { maximum: 50 }, allow_blank: true

  before_validation :normalize_email

  # Find or create a lead for a signup, returning the lead and website_lead
  def self.find_or_create_for_signup(account:, website:, email:, name: nil, phone: nil, visit: nil, visitor_token: nil, gclid: nil, fbclid: nil,
    utm_source: nil, utm_medium: nil, utm_campaign: nil, utm_content: nil, utm_term: nil)
    normalized_email = normalize_email(email)

    lead = account.leads.find_by(email: normalized_email)
    created = false

    if lead.nil?
      lead = account.leads.create!(email: normalized_email, name: name, phone: phone)
      created = true
    end

    # Always backfill phone if the lead doesn't have one yet
    if !created && lead.phone.blank? && phone.present?
      lead.update!(phone: phone)
    end

    # Check if already converted on this website
    existing_website_lead = lead.website_leads.find_by(website_id: website.id)
    if existing_website_lead
      return { lead: lead, website_lead: existing_website_lead, created: false, already_converted: true }
    end

    # Create the website_lead with attribution (denormalized from visit for durability)
    website_lead = lead.website_leads.create!(
      website: website,
      visit: visit,
      visitor_token: visitor_token,
      gclid: gclid || visit&.gclid,
      fbclid: fbclid || visit&.fbclid,
      utm_source: utm_source || visit&.utm_source,
      utm_medium: utm_medium || visit&.utm_medium,
      utm_campaign: utm_campaign || visit&.utm_campaign,
      utm_content: utm_content || visit&.utm_content,
      utm_term: utm_term || visit&.utm_term
    )

    { lead: lead, website_lead: website_lead, created: created, already_converted: false }
  end

  private

  def normalize_email
    self.email = self.class.normalize_email(email)
  end

  class << self
    def normalize_email(email)
      email&.downcase&.strip
    end
  end
end
