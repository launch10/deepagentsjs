# == Schema Information
#
# Table name: accounts
#
#  id                  :bigint           not null, primary key
#  account_users_count :integer          default(0)
#  billing_email       :string
#  domain              :string
#  extra_billing_info  :text
#  name                :string           not null
#  personal            :boolean          default(FALSE)
#  subdomain           :string
#  time_zone           :string           default("America/New_York")
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  owner_id            :bigint
#
# Indexes
#
#  index_accounts_on_name      (name) UNIQUE
#  index_accounts_on_owner_id  (owner_id)
#
# Foreign Keys
#
#  fk_rails_...  (owner_id => users.id)
#

class Account < ApplicationRecord
  has_prefix_id :acct

  include Billing
  include Domains
  include Transfer
  include Atlas::Account
  include AccountConcerns::TrafficLimits
  include AccountConcerns::GoogleAdsAccount

  belongs_to :owner, class_name: "User"
  has_one :ads_account, dependent: :destroy
  has_many :account_invitations, dependent: :destroy
  has_many :ads_account_invitations, through: :ads_account, class_name: "AdsAccountInvitation", dependent: :destroy, source: :invitations
  has_many :account_users, dependent: :destroy
  has_many :campaigns, dependent: :destroy
  has_many :notification_mentions, as: :record, dependent: :destroy, class_name: "Noticed::Event"
  has_many :account_notifications, dependent: :destroy, class_name: "Noticed::Event"
  has_many :users, through: :account_users
  has_many :projects, dependent: :destroy
  has_many :chats, dependent: :destroy
  has_many :websites, through: :projects
  has_many :brainstorms, through: :websites
  has_many :domains
  has_many :website_urls
  has_many :domain_request_counts
  has_many :account_request_counts
  has_many :themes, as: :author
  has_many :uploads
  has_one :firewall, class_name: "Cloudflare::Firewall"
  has_many :ads_accounts, dependent: :destroy
  has_many :job_runs, dependent: :destroy

  scope :personal, -> { where(personal: true) }
  scope :team, -> { where(personal: false) }
  scope :sorted, -> { order(personal: :desc, name: :asc) }

  has_one_attached :avatar

  validates :avatar, resizable_image: true
  validates :name, presence: true

  def team?
    !personal?
  end

  def personal_account_for?(user)
    personal? && owner?(user)
  end

  def owner?(user)
    owner_id == user&.id
  end

  def plan
    subscriptions.active.order(id: :desc).limit(1).first&.plan
  end

  def google_connected_account
    owner&.connected_accounts&.find_by(provider: "google_oauth2")
  end

  def google_email_address
    google_connected_account&.email
  end

  def google_account_invitation
    ads_account_invitations.where(platform: "google").first
  end

  def has_google_connected_account?
    google_connected_account.present?
  end

  def current_plan_id
    plan&.id
  end

  def plan_limits
    plan&.plan_limits || []
  end
end
