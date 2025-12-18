FactoryBot.define do
  factory :ad_schedule do
    association :campaign
    day_of_week { "Monday" }
    start_hour { 9 }
    start_minute { 0 }
    end_hour { 17 }
    end_minute { 0 }
    always_on { false }
    platform_settings { {} }

    trait :always_on do
      day_of_week { nil }
      start_hour { nil }
      start_minute { nil }
      end_hour { nil }
      end_minute { nil }
      always_on { true }
    end

    trait :with_criterion_id do
      platform_settings { { "google" => { "criterion_id" => "123456" } } }
    end
  end
end
