FactoryBot.define do
  factory :firewall_rule do
    association :firewall
    domain { "spam-#{SecureRandom.hex(4)}.example.com" }
    status { 'pending' }
    request_count { 0 }
    error_count { 0 }

    trait :blocked do
      status { 'blocked' }
      cloudflare_rule_id { "cf_rule_#{SecureRandom.hex(8)}" }
      blocked_at { Time.current }
    end

    trait :failed do
      status { 'failed' }
      last_error { 'API Error' }
      error_count { 1 }
      last_attempted_at { Time.current }
    end
  end
end
