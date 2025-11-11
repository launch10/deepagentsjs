require 'faker'

FactoryBot.define do
  factory :chat do
    name { Faker::Name.name }
    chat_type { 'brainstorm' }
    thread_id { SecureRandom.uuid }
    project_id { 1 }
    account_id { 1 }
    contextable { association(:brainstorm) }
  end
end