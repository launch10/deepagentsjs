# == Schema Information
#
# Table name: domain_request_counts
#
#  id            :integer          not null, primary key
#  domain_id     :integer          not null
#  account_id    :integer          not null
#  request_count :integer          not null
#  hour          :timestamptz      not null, primary key
#  created_at    :timestamptz      not null
#
# Indexes
#
#  index_domain_request_counts_on_account_domain_and_hour  (account_id,domain_id,hour) UNIQUE
#  index_domain_request_counts_on_account_id_and_hour      (account_id,hour)
#  index_domain_request_counts_on_domain_hour_count        (domain_id,hour,request_count)
#  index_domain_request_counts_on_domain_id_and_hour       (domain_id,hour)
#

FactoryBot.define do
  factory :domain_request_count do
    association :domain
    association :account
    request_count { 100 }
    hour { Time.current.beginning_of_hour }
    created_at { Time.current }
  end
end
