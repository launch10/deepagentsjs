FactoryBot.define do
  factory :website_deploy do
    association :website
    status { 'pending' }
    trigger { 'manual' }
    snapshot_id { SecureRandom.uuid }

    trait :building do
      status { 'building' }
    end

    trait :uploading do
      status { 'uploading' }
    end

    trait :completed do
      status { 'completed' }
    end

    trait :failed do
      status { 'failed' }
      stacktrace { "Error: Build failed\n  at line 42" }
    end

    trait :auto_triggered do
      trigger { 'auto' }
    end
  end
end
