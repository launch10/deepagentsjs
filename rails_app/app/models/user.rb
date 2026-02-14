# == Schema Information
#
# Table name: users
#
#  id                     :bigint           not null, primary key
#  accepted_privacy_at    :datetime
#  accepted_terms_at      :datetime
#  admin                  :boolean
#  announcements_read_at  :datetime
#  confirmation_sent_at   :datetime
#  confirmation_token     :string
#  confirmed_at           :datetime
#  email                  :string           default(""), not null
#  encrypted_password     :string           default(""), not null
#  first_name             :string
#  invitation_accepted_at :datetime
#  invitation_created_at  :datetime
#  invitation_limit       :integer
#  invitation_sent_at     :datetime
#  invitation_token       :string
#  invitations_count      :integer          default(0)
#  invited_by_type        :string
#  jti                    :string           not null
#  last_name              :string
#  last_otp_timestep      :integer
#  name                   :string
#  otp_backup_codes       :text
#  otp_required_for_login :boolean
#  otp_secret             :string
#  preferences            :jsonb
#  preferred_language     :string
#  remember_created_at    :datetime
#  reset_password_sent_at :datetime
#  reset_password_token   :string
#  time_zone              :string
#  unconfirmed_email      :string
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#  invited_by_id          :bigint
#
# Indexes
#
#  index_users_on_email                              (email) UNIQUE
#  index_users_on_invitation_token                   (invitation_token) UNIQUE
#  index_users_on_invitations_count                  (invitations_count)
#  index_users_on_invited_by_id                      (invited_by_id)
#  index_users_on_invited_by_type_and_invited_by_id  (invited_by_type,invited_by_id)
#  index_users_on_jti                                (jti) UNIQUE
#  index_users_on_reset_password_token               (reset_password_token) UNIQUE
#

class User < ApplicationRecord
  has_prefix_id :user

  include Accounts
  include Agreements
  include Authenticatable
  include Mentions
  include Notifiable
  include Searchable
  include Theme

  has_one_attached :avatar
  has_person_name

  validates :avatar, resizable_image: true
  validates :name, presence: true

  has_one :owned_account, class_name: "Account", foreign_key: "owner_id", dependent: :destroy
  has_one :payment_processor, through: :owned_account
  has_many :subscriptions, through: :owned_account

  # Whenever we manage user-visibility, we should add it here to projects
  has_many :projects, through: :accounts
  has_many :websites, through: :projects
  has_many :support_requests

  def plan
    subscriptions.active.order(id: :desc).limit(1).first&.plan
  end

  def current_plan_id
    plan&.id
  end

  def account
    owned_account
  end

  def confirmed?
    confirmed_at.present?
  end

  def track_signup
    acct = owned_account
    attribution = acct&.signup_attribution
    method = connected_accounts.any? ? connected_accounts.last.provider : "email"
    event_data = {
      user: self,
      account: acct,
      method: method
    }
    event_data.merge!(attribution.symbolize_keys) if attribution.present?
    TrackEvent.call("user_signed_up", **event_data)
    PosthogTracker.identify(self, posthog_attribution_properties(attribution))
  end

  private

  def posthog_attribution_properties(attribution = nil)
    attribution ||= owned_account&.signup_attribution
    return {} unless attribution.present?

    {
      initial_utm_source: attribution["utm_source"],
      initial_utm_medium: attribution["utm_medium"],
      initial_utm_campaign: attribution["utm_campaign"],
      initial_utm_term: attribution["utm_term"],
      initial_utm_content: attribution["utm_content"],
      initial_icp: attribution["icp"],
      initial_landing_page: attribution["landing_page"],
      initial_referrer: attribution["referrer"],
      initial_gclid: attribution["gclid"],
      initial_fbclid: attribution["fbclid"]
    }.compact
  end
end
