require 'faker'

FactoryBot.define do
  factory :website do
    name { Faker::Internet.domain_name }
    project { FactoryBot.create(:project) }
    user { FactoryBot.create(:user) }
  end
end
