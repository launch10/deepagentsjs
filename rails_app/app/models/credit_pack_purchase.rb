# == Schema Information
#
# Table name: credit_pack_purchases
#
#  id                :bigint           not null, primary key
#  credits_purchased :integer          not null
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
#  index_credit_pack_purchases_on_pay_charge_id              (pay_charge_id)
#
class CreditPackPurchase < ApplicationRecord
  belongs_to :account
  belongs_to :credit_pack
  belongs_to :pay_charge, class_name: "Pay::Charge", optional: true

  validates :credits_purchased, presence: true, numericality: { greater_than: 0 }
  validates :price_cents, presence: true, numericality: { greater_than: 0 }

  scope :unused, -> { where(is_used: false) }
  scope :used, -> { where(is_used: true) }
  scope :for_account, ->(account) { where(account: account) }
  scope :oldest_first, -> { order(created_at: :asc) }

  def mark_used!
    update!(is_used: true)
  end
end
