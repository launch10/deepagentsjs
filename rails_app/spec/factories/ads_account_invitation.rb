FactoryBot.define do
  factory :ads_account_invitation do
    association :ads_account
    email_address { Faker::Internet.email }
    platform { "google" }

    trait :pending do
      after(:build) do |invitation|
        invitation.google_status = "pending"
      end
    end

    trait :sent do
      after(:build) do |invitation|
        invitation.google_status = "sent"
        invitation.google_invitation_id = SecureRandom.hex(8)
        invitation.google_sent_at = Time.current.iso8601
      end
    end

    trait :accepted do
      after(:build) do |invitation|
        invitation.google_status = "accepted"
        invitation.google_user_access_id = SecureRandom.hex(8)
        invitation.google_accepted_at = Time.current.iso8601
      end
    end

    trait :declined do
      after(:build) do |invitation|
        invitation.google_status = "declined"
      end
    end

    trait :expired do
      after(:build) do |invitation|
        invitation.google_status = "expired"
      end
    end
  end
end
