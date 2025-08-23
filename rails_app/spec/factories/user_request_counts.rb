# == Schema Information
#
# Table name: user_request_counts
#
#  id            :integer          not null, primary key
#  user_id       :integer          not null
#  request_count :integer          not null
#  month         :timestamptz      not null, primary key
#  created_at    :timestamptz      not null
#
# Indexes
#
#  index_user_request_counts_on_user_id_and_month  (user_id,month)
#  index_user_request_counts_on_user_month         (user_id,month,request_count) UNIQUE
#

FactoryBot.define do
  factory :user_request_count do
    association :user
    month { Time.current.beginning_of_month }
    request_count { 1000 }
    last_updated_at { Time.current }
  end
end
