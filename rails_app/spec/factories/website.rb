require 'faker'

FactoryBot.define do
  factory :website do
    name { Faker::Internet.domain_name }
    project { FactoryBot.create(:project) }
    account { FactoryBot.create(:account) }
    thread_id { SecureRandom.uuid }
  end
end
