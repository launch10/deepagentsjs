FactoryBot.define do
  factory :agent_context_event do
    account
    event_type { "images.created" }
    payload { {} }

    trait :with_project do
      project
    end

    trait :with_user do
      user
    end

    trait :images_created do
      event_type { "images.created" }
      payload { { upload_id: 1, filename: "test.jpg", url: "https://example.com/test.jpg" } }
    end

    trait :images_deleted do
      event_type { "images.deleted" }
      payload { { upload_id: 1, filename: "test.jpg" } }
    end
  end
end
