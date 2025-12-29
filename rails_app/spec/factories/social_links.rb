FactoryBot.define do
  factory :social_link do
    project
    platform { SocialLink::PLATFORMS.sample }
    url { "https://example.com/#{platform}" }
    handle { "@example" }

    trait :twitter do
      platform { "twitter" }
      url { "https://twitter.com/example" }
      handle { "@example" }
    end

    trait :instagram do
      platform { "instagram" }
      url { "https://instagram.com/example" }
      handle { "@example" }
    end

    trait :linkedin do
      platform { "linkedin" }
      url { "https://linkedin.com/company/example" }
      handle { nil }
    end

    trait :facebook do
      platform { "facebook" }
      url { "https://facebook.com/example" }
      handle { nil }
    end
  end
end
