# == Schema Information
#
# Table name: credit_pack_purchases
#
#  id                :bigint           not null, primary key
#  credits_allocated :boolean          default(FALSE), not null
#  credits_purchased :integer          not null
#  credits_used      :integer          default(0), not null
#  is_used           :boolean          default(FALSE), not null
#  price_cents       :integer          not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  account_id        :bigint           not null
#  credit_pack_id    :bigint           not null
#  pay_charge_id     :bigint
#
# Indexes
#
#  index_credit_pack_purchases_on_account_id                 (account_id)
#  index_credit_pack_purchases_on_account_id_and_created_at  (account_id,created_at)
#  index_credit_pack_purchases_on_account_id_and_is_used     (account_id,is_used)
#  index_credit_pack_purchases_on_credit_pack_id             (credit_pack_id)
#  index_credit_pack_purchases_on_credits_allocated          (credits_allocated)
#  index_credit_pack_purchases_on_pay_charge_id              (pay_charge_id)
#
class CreditPackPurchase < ApplicationRecord
  belongs_to :account
  belongs_to :credit_pack
  belongs_to :pay_charge, class_name: "Pay::Charge", optional: true

  validates :credits_purchased, presence: true, numericality: { greater_than: 0 }
  validates :credits_used, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :price_cents, presence: true, numericality: { greater_than: 0 }
  validate :credits_used_not_exceeding_purchased
  validate :account_has_active_subscription, on: :create

  scope :unused, -> { where(is_used: false) }
  scope :used, -> { where(is_used: true) }
  scope :for_account, ->(account) { where(account: account) }
  scope :oldest_first, -> { order(created_at: :asc) }

  # Returns credits remaining in this pack
  def credits_remaining
    credits_purchased - credits_used
  end

  # Check if pack is fully consumed
  def fully_consumed?
    credits_used >= credits_purchased
  end

  # Mark pack as fully used
  def mark_used!
    update!(is_used: true)
  end

  private

  def credits_used_not_exceeding_purchased
    return unless credits_used && credits_purchased
    if credits_used > credits_purchased
      errors.add(:credits_used, "cannot exceed credits_purchased")
    end
  end

  def account_has_active_subscription
    return unless account.present?
    unless account.subscriptions.active.exists?
      errors.add(:base, "Account must have an active subscription to purchase credit packs")
    end
  end
end
