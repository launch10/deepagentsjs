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
FactoryBot.define do
  factory :credit_pack_purchase do
    association :account, factory: [:account, :subscribed]
    association :credit_pack
    credits_purchased { 500 }
    price_cents { 2500 }
    is_used { false }
  end
end
