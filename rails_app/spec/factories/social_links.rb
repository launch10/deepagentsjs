# == Schema Information
#
# Table name: social_links
#
#  id         :bigint           not null, primary key
#  handle     :string
#  platform   :string           not null
#  url        :string           not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  project_id :bigint           not null
#
# Indexes
#
#  index_social_links_on_project_id               (project_id)
#  index_social_links_on_project_id_and_platform  (project_id,platform) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (project_id => projects.id)
#
FactoryBot.define do
  factory :social_link do
    project
    platform { SocialLink::PLATFORMS.sample }
    url { "https://example.com/#{platform}" }
    handle { "@example" }

    trait :twitter do
      platform { "twitter" }
      url { "https://twitter.com/example" }
      handle { "@example" }
    end

    trait :instagram do
      platform { "instagram" }
      url { "https://instagram.com/example" }
      handle { "@example" }
    end

    trait :linkedin do
      platform { "linkedin" }
      url { "https://linkedin.com/company/example" }
      handle { nil }
    end

    trait :facebook do
      platform { "facebook" }
      url { "https://facebook.com/example" }
      handle { nil }
    end
  end
end
