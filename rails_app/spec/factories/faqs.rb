# frozen_string_literal: true

FactoryBot.define do
  factory :faq do
    sequence(:question) { |n| "How do I do thing #{n}?" }
    answer { "Here is how you do that thing. Follow these steps..." }
    category { "google_ads" }
    sequence(:slug) { |n| "how-do-i-do-thing-#{n}" }
    position { 0 }
    published { true }
  end
end
