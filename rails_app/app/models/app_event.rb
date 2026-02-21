# == Schema Information
#
# Table name: app_events
#
#  id          :bigint           not null, primary key
#  event_name  :string           not null
#  properties  :jsonb
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  account_id  :bigint
#  campaign_id :bigint
#  project_id  :bigint
#  user_id     :bigint
#  website_id  :bigint
#
# Indexes
#
#  index_app_events_on_account_id                 (account_id)
#  index_app_events_on_campaign_id                (campaign_id)
#  index_app_events_on_created_at                 (created_at)
#  index_app_events_on_event_name                 (event_name)
#  index_app_events_on_event_name_and_created_at  (event_name,created_at)
#  index_app_events_on_project_id                 (project_id)
#  index_app_events_on_user_id                    (user_id)
#  index_app_events_on_website_id                 (website_id)
#
class AppEvent < ApplicationRecord
  belongs_to :account, optional: true
  belongs_to :user, optional: true
  belongs_to :project, optional: true
  belongs_to :campaign, optional: true
  belongs_to :website, optional: true

  validates :event_name, presence: true
end
