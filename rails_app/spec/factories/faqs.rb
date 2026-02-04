# frozen_string_literal: true

# == Schema Information
#
# Table name: faqs
#
#  id          :bigint           not null, primary key
#  answer      :text             not null
#  category    :string           not null
#  position    :integer          default(0), not null
#  published   :boolean          default(TRUE), not null
#  question    :string           not null
#  slug        :string           not null
#  subcategory :string
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#
# Indexes
#
#  index_faqs_on_category                (category)
#  index_faqs_on_published_and_position  (published,position)
#  index_faqs_on_slug                    (slug) UNIQUE
#
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
