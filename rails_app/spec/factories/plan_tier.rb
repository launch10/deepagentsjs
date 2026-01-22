FactoryBot.define do
  factory :plan_tier do
    sequence(:name) { |n| "tier_#{n}" }
    description { "Test tier description" }
    details { {features: ["Feature 1"], credits: 1000} }

    trait :starter do
      name { "starter" }
      description { "Perfect for solo founders testing the waters" }
      details { {features: ["1M requests/month", "1 subdomain"], credits: 2000} }
    end

    trait :growth do
      name { "growth" }
      description { "For serious founders ready to validate at scale" }
      details { {features: ["5M requests/month", "2 subdomains"], credits: 5000} }
    end

    trait :pro do
      name { "pro" }
      description { "Maximum validation for teams with multiple ventures" }
      details { {features: ["20M requests/month", "3 subdomains"], credits: 15000} }
    end
  end
end
