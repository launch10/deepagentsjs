FactoryBot.define do
  factory :website_lead do
    association :lead
    association :website

    trait :with_visit do
      association :visit, factory: :ahoy_visit
    end

    trait :with_attribution do
      visitor_token { SecureRandom.uuid }
      gclid { "test-gclid-#{SecureRandom.hex(4)}" }
    end
  end
end
