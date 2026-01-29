# frozen_string_literal: true

FactoryBot.define do
  factory :ahoy_event, class: "Ahoy::Event" do
    association :visit, factory: :ahoy_visit
    name { "page_view" }
    time { Time.current }
    properties { { path: "/" } }

    trait :page_view do
      name { "page_view" }
      properties { { path: "/" } }
    end

    trait :form_submit do
      name { "form_submit" }
      properties { { form_id: "lead-form" } }
    end
  end
end
