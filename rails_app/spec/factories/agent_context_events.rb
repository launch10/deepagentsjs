# == Schema Information
#
# Table name: agent_context_events
#
#  id             :bigint           not null, primary key
#  event_type     :string           not null
#  eventable_type :string
#  payload        :jsonb
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  account_id     :bigint           not null
#  eventable_id   :bigint
#  project_id     :bigint
#  user_id        :bigint
#
# Indexes
#
#  index_agent_context_events_on_account_id                       (account_id)
#  index_agent_context_events_on_created_at                       (created_at)
#  index_agent_context_events_on_event_type                       (event_type)
#  index_agent_context_events_on_eventable_type_and_eventable_id  (eventable_type,eventable_id)
#  index_agent_context_events_on_project_id_and_created_at        (project_id,created_at)
#
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
