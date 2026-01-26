require 'faker'

FactoryBot.define do
  factory :account do
    sequence(:name) { |n| "Account #{n}" }
    association :owner, factory: :user

    trait :with_google_account do
      after(:create) do |account|
        create(:connected_account, :google, owner: account.owner, auth: {
          "info" => {
            "email" => account.owner.email,
            "name" => account.owner.name
          }
        })
      end
    end

    trait :subscribed do
      after(:create) do |account|
        payment_processor = account.set_payment_processor(:fake_processor, allow_fake: true)
        payment_processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
        plan = Plan.find_by(name: "growth_monthly") || create(:plan, :growth_monthly)
        plan.update!(fake_processor_id: plan.name) unless plan.fake_processor_id.present?

        payment_processor.subscriptions.create!(
          processor_id: "sub_#{SecureRandom.hex(8)}",
          name: "default",
          processor_plan: plan.fake_processor_id,
          status: "active",
          current_period_start: Time.current,
          current_period_end: 30.days.from_now
        )
      end
    end
  end
end
