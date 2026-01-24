# == Schema Information
#
# Table name: credit_packs
#
#  id              :bigint           not null, primary key
#  credits         :integer          not null
#  currency        :string           default("usd")
#  name            :string           not null
#  price_cents     :integer          not null
#  visible         :boolean          default(TRUE)
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  stripe_price_id :string
#
# Indexes
#
#  index_credit_packs_on_name  (name) UNIQUE
#
FactoryBot.define do
  factory :credit_pack do
    sequence(:name) { |n| "Pack #{n}" }
    credits { 500 }
    price_cents { 2500 }
    currency { "usd" }
    visible { true }
  end
end
