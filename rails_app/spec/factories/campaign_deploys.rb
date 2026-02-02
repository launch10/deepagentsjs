# == Schema Information
#
# Table name: campaign_deploys
#
#  id                  :bigint           not null, primary key
#  current_step        :string
#  deleted_at          :datetime
#  stacktrace          :text
#  status              :string           default("pending"), not null
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  campaign_history_id :bigint
#  campaign_id         :bigint           not null
#
# Indexes
#
#  index_campaign_deploys_on_campaign_history_id     (campaign_history_id)
#  index_campaign_deploys_on_campaign_id             (campaign_id)
#  index_campaign_deploys_on_campaign_id_and_status  (campaign_id,status)
#  index_campaign_deploys_on_created_at              (created_at)
#  index_campaign_deploys_on_current_step            (current_step)
#  index_campaign_deploys_on_deleted_at              (deleted_at)
#  index_campaign_deploys_on_status                  (status)
#
FactoryBot.define do
  factory :campaign_deploy do
    association :campaign

    status { "pending" }
    current_step { nil }

    trait :at_final_step do
      current_step { "create_ads" }
      status { "running" }
    end
  end
end
