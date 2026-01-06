FactoryBot.define do
  factory :connected_account do
    association :owner, factory: :user
    provider { "google_oauth2" }
    uid { SecureRandom.uuid }
    access_token { SecureRandom.hex(32) }
    refresh_token { SecureRandom.hex(32) }
    expires_at { 1.hour.from_now }
    auth do
      {
        "info" => {
          "email" => owner&.email || "test@example.com",
          "name" => owner&.name || "Test User"
        }
      }
    end

    trait :google do
      provider { "google_oauth2" }
    end
  end
end
