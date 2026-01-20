require 'faker'

FactoryBot.define do
  factory :brainstorm do
    website { build(:website) }
  end
end
