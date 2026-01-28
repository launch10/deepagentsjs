# frozen_string_literal: true

FactoryBot.define do
  factory :credit_usage_adjustment do
    account
    admin factory: :user
    amount { 100 }
    reason { "billing_correction" }
    notes { "Test adjustment" }
    credits_adjusted { false }
  end
end
