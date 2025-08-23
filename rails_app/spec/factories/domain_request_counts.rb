# == Schema Information
#
# Table name: domain_request_counts
#
#  id            :integer          not null, primary key
#  domain_id     :integer          not null
#  user_id       :integer          not null
#  request_count :integer          not null
#  hour          :timestamptz      not null, primary key
#  created_at    :timestamptz      not null
#
# Indexes
#
#  index_domain_request_counts_on_domain_hour_count     (domain_id,hour,request_count)
#  index_domain_request_counts_on_domain_id_and_hour    (domain_id,hour)
#  index_domain_request_counts_on_user_domain_and_hour  (user_id,domain_id,hour) UNIQUE
#  index_domain_request_counts_on_user_id_and_hour      (user_id,hour)
#

FactoryBot.define do
  factory :domain_request_count do
    association :domain
    association :user
    request_count { 100 }
    counted_at { Time.current.beginning_of_hour }
  end
end
