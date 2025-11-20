# == Schema Information
#
# Table name: account_request_counts
#
#  id            :bigint           not null, primary key
#  month         :timestamptz      not null, primary key
#  request_count :bigint           not null
#  created_at    :timestamptz      not null
#  account_id    :bigint           not null
#
# Indexes
#
#  index_account_request_counts_on_account_id_and_month  (account_id,month)
#  index_account_request_counts_on_account_month         (account_id,month,request_count) UNIQUE
#

FactoryBot.define do
  factory :account_request_count do
    association :account
    month { Time.current.beginning_of_month }
    request_count { 1000 }
    last_updated_at { Time.current }
  end
end
