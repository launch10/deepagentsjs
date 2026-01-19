require 'faker'

FactoryBot.define do
  factory :chat do
    name { Faker::Name.name }
    chat_type { 'brainstorm' }
    thread_id { SecureRandom.uuid }
    association :project
    association :account
    contextable { nil }  # Optional - set explicitly when needed
  end
end
