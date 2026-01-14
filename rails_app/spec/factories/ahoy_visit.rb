FactoryBot.define do
  factory :ahoy_visit, class: 'Ahoy::Visit' do
    association :website
    visitor_token { SecureRandom.uuid }
    visit_token { SecureRandom.uuid }
    started_at { Time.current }

    trait :with_gclid do
      gclid { "test-gclid-#{SecureRandom.hex(4)}" }
    end

    trait :with_utm do
      utm_source { 'google' }
      utm_medium { 'cpc' }
      utm_campaign { 'test_campaign' }
    end

    trait :with_referrer do
      referrer { 'https://google.com/search?q=test' }
      referring_domain { 'google.com' }
    end
  end
end
