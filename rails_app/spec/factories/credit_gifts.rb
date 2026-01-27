# frozen_string_literal: true

# == Schema Information
#
# Table name: credit_gifts
#
#  id                :bigint           not null, primary key
#  amount            :integer          not null
#  credits_allocated :boolean          default(FALSE), not null
#  notes             :text
#  reason            :string           not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  account_id        :bigint           not null
#  admin_id          :bigint           not null
#
# Indexes
#
#  index_credit_gifts_on_account_id                 (account_id)
#  index_credit_gifts_on_account_id_and_created_at  (account_id,created_at)
#  index_credit_gifts_on_admin_id                   (admin_id)
#  index_credit_gifts_on_credits_allocated          (credits_allocated)
#
FactoryBot.define do
  factory :credit_gift do
    association :account
    association :admin, factory: :user
    amount { 500 }
    reason { "customer_support" }
    notes { nil }
  end
end
