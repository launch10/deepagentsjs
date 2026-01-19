FactoryBot.define do
  factory :job_run do
    association :account
    job_class { "CampaignDeploy" }
    status { "pending" }
    job_args { {} }

    trait :pending do
      status { "pending" }
    end

    trait :running do
      status { "running" }
      started_at { Time.current }
    end

    trait :completed do
      status { "completed" }
      started_at { 5.minutes.ago }
      completed_at { Time.current }
    end

    trait :failed do
      status { "failed" }
      started_at { 5.minutes.ago }
      completed_at { Time.current }
      error_message { "Job failed" }
    end

    trait :with_langgraph_callback do
      langgraph_thread_id { "thread_#{SecureRandom.hex(8)}" }
    end
  end
end
