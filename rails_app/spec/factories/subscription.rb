require 'faker'

FactoryBot.define do
  factory :subscription do
    association :account
    association :plan
    processor { "stripe" }
    processor_id { "sub_#{SecureRandom.hex(8)}" }
    status { "active" }
    current_period_start { Time.current }
    current_period_end { 30.days.from_now }
  end
end