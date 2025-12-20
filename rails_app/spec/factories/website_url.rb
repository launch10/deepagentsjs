FactoryBot.define do
  factory :website_url do
    association :website
    association :domain
    association :account
    path { "/" }

    trait :with_path do
      transient do
        url_path { "/campaign" }
      end

      path { url_path }
    end
  end
end
