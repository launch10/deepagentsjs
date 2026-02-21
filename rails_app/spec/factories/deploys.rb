# == Schema Information
#
# Table name: deploys
#
#  id                 :bigint           not null, primary key
#  active             :boolean          default(TRUE), not null
#  current_step       :string
#  deleted_at         :datetime
#  deploy_type        :string           default("website"), not null
#  finished_at        :datetime
#  is_live            :boolean          default(FALSE)
#  stacktrace         :text
#  status             :string           default("pending"), not null
#  user_active_at     :datetime
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  campaign_deploy_id :bigint
#  project_id         :bigint           not null
#  thread_id          :string           not null
#  website_deploy_id  :bigint
#
# Indexes
#
#  index_deploys_on_active_project          (project_id,active) UNIQUE WHERE ((deleted_at IS NULL) AND (active = true))
#  index_deploys_on_campaign_deploy_id      (campaign_deploy_id)
#  index_deploys_on_deleted_at              (deleted_at)
#  index_deploys_on_deploy_type             (deploy_type)
#  index_deploys_on_finished_at             (finished_at)
#  index_deploys_on_is_live                 (is_live)
#  index_deploys_on_project_id              (project_id)
#  index_deploys_on_project_id_and_is_live  (project_id,is_live)
#  index_deploys_on_project_id_and_status   (project_id,status)
#  index_deploys_on_status                  (status)
#  index_deploys_on_thread_id               (thread_id)
#  index_deploys_on_website_deploy_id       (website_deploy_id)
#
# Foreign Keys
#
#  fk_rails_...  (campaign_deploy_id => campaign_deploys.id)
#  fk_rails_...  (project_id => projects.id)
#  fk_rails_...  (website_deploy_id => website_deploys.id)
#
FactoryBot.define do
  factory :deploy do
    association :project

    status { "pending" }
    current_step { nil }
    is_live { false }
    deploy_type { "website" }

    trait :website_only do
      deploy_type { "website" }
    end

    trait :full_deploy do
      deploy_type { "campaign" }
    end

    trait :running do
      status { "running" }
    end

    trait :completed do
      status { "completed" }
    end

    trait :failed do
      status { "failed" }
    end

    trait :live do
      is_live { true }
      status { "completed" }
    end
  end
end
