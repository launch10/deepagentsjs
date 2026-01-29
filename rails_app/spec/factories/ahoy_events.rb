# frozen_string_literal: true

# == Schema Information
#
# Table name: ahoy_events
#
#  id         :bigint           not null, primary key
#  name       :string
#  properties :jsonb
#  time       :datetime
#  visit_id   :bigint
#
# Indexes
#
#  index_ahoy_events_on_name_and_time  (name,time)
#  index_ahoy_events_on_properties     (properties) USING gin
#  index_ahoy_events_on_visit_id       (visit_id)
#
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
