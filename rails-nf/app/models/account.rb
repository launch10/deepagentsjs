# == Schema Information
#
# Table name: accounts
#
#  id                  :integer          not null, primary key
#  name                :string           not null
#  owner_id            :integer
#  personal            :boolean          default("false")
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  extra_billing_info  :text
#  domain              :string
#  subdomain           :string
#  billing_email       :string
#  account_users_count :integer          default("0")
#
# Indexes
#
#  index_accounts_on_owner_id  (owner_id)
#

class Account < ApplicationRecord
  has_prefix_id :acct

  include Billing
  include Domains
  include Transfer

  belongs_to :owner, class_name: "User"
  has_many :account_invitations, dependent: :destroy
  has_many :account_users, dependent: :destroy
  has_many :notification_mentions, as: :record, dependent: :destroy, class_name: "Noticed::Event"
  has_many :account_notifications, dependent: :destroy, class_name: "Noticed::Event"
  has_many :users, through: :account_users

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
end
