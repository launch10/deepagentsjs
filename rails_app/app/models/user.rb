# == Schema Information
#
# Table name: users
#
#  id                     :integer          not null, primary key
#  email                  :string           default(""), not null
#  encrypted_password     :string           default(""), not null
#  reset_password_token   :string
#  reset_password_sent_at :datetime
#  remember_created_at    :datetime
#  confirmation_token     :string
#  confirmed_at           :datetime
#  confirmation_sent_at   :datetime
#  unconfirmed_email      :string
#  first_name             :string
#  last_name              :string
#  time_zone              :string
#  accepted_terms_at      :datetime
#  accepted_privacy_at    :datetime
#  announcements_read_at  :datetime
#  admin                  :boolean
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#  invitation_token       :string
#  invitation_created_at  :datetime
#  invitation_sent_at     :datetime
#  invitation_accepted_at :datetime
#  invitation_limit       :integer
#  invited_by_type        :string
#  invited_by_id          :integer
#  invitations_count      :integer          default("0")
#  preferred_language     :string
#  otp_required_for_login :boolean
#  otp_secret             :string
#  last_otp_timestep      :integer
#  otp_backup_codes       :text
#  preferences            :jsonb
#  name                   :string
#  jti                    :string           not null
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
  include AtlasSyncable

  has_one_attached :avatar
  has_person_name

  validates :avatar, resizable_image: true
  validates :name, presence: true

  has_one :owned_account, class_name: "Account", foreign_key: "owner_id", dependent: :destroy
  has_one :payment_processor, through: :owned_account
  has_many :subscriptions, through: :owned_account
  
  def plan
    subscriptions.active.first&.plan
  end
  
  def plan_limits
    plan&.plan_limits || []
  end

  has_many :projects, through: :owned_account
  has_many :websites, through: :projects
  has_many :domains
  has_many :domain_request_counts
  has_many :user_request_counts
  has_one :firewall
  
  def current_plan_id
    plan&.id
  end
  
  def account
    owned_account
  end

  private
end
