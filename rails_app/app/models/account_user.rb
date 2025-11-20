# == Schema Information
#
# Table name: account_users
#
#  id         :bigint           not null, primary key
#  roles      :jsonb            not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint
#  user_id    :bigint
#
# Indexes
#
#  index_account_users_on_account_id_and_user_id  (account_id,user_id) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#  fk_rails_...  (user_id => users.id)
#

class AccountUser < ApplicationRecord
  # Add account roles to this line
  # Do NOT to use any reserved words like `user` or `account`
  ROLES = [:admin, :member]

  include UpdatesSubscriptionQuantity
  include Roles

  belongs_to :account, counter_cache: true
  belongs_to :user

  validates :user_id, uniqueness: {scope: :account_id}
  validate :owner_must_be_admin, on: :update, if: -> { admin_changed? && account_owner? }

  # Updates the subscription quantity automatically when charge_per_unit is enabled
  updates_subscription_quantity -> { account.per_unit_quantity }

  def account_owner?
    account.owner?(user)
  end

  def owner_must_be_admin
    errors.add :admin, :cannot_be_removed unless admin?
  end
end
