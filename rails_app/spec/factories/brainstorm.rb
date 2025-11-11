require 'faker'

FactoryBot.define do
  factory :brainstorm do
    thread_id { SecureRandom.uuid }
  end
end