FactoryBot.define do
  factory :ad_location_target do
    association :campaign
    target_type { "geo_location" }
    location_name { "United States" }
    country_code { "US" }
    targeted { true }
    google_geo_target_constant { "geoTargetConstants/2840" }
    platform_settings { { "google" => { "geo_target_constant" => "geoTargetConstants/2840" } } }

    trait :radius do
      target_type { "radius" }
      location_name { nil }
      platform_settings { {} }
      address_line_1 { "123 Main St" }
      city { "San Francisco" }
      state { "CA" }
      postal_code { "94102" }
      radius { 10 }
      radius_units { "MILES" }
    end

    trait :excluded do
      targeted { false }
    end
  end
end
