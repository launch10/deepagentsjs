# == Schema Information
#
# Table name: campaigns
#
#  id                 :bigint           not null, primary key
#  daily_budget_cents :integer
#  launched_at        :datetime
#  name               :string
#  platform_settings  :jsonb
#  stage              :string           default("content")
#  status             :string           default("draft")
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint
#  project_id         :bigint
#  website_id         :bigint
#
# Indexes
#
#  index_campaigns_on_account_id             (account_id)
#  index_campaigns_on_account_id_and_stage   (account_id,stage)
#  index_campaigns_on_account_id_and_status  (account_id,status)
#  index_campaigns_on_created_at             (created_at)
#  index_campaigns_on_launched_at            (launched_at)
#  index_campaigns_on_platform_settings      (platform_settings) USING gin
#  index_campaigns_on_project_id             (project_id)
#  index_campaigns_on_project_id_and_stage   (project_id,stage)
#  index_campaigns_on_project_id_and_status  (project_id,status)
#  index_campaigns_on_stage                  (stage)
#  index_campaigns_on_status                 (status)
#  index_campaigns_on_website_id             (website_id)
#
class Campaign < ApplicationRecord
  include CampaignConcerns::Creation
  include CampaignConcerns::Stages
  include CampaignConcerns::Scheduling
  include CampaignConcerns::LocationTargeting
  include CampaignConcerns::PlatformSettings
  include CampaignConcerns::GooglePlatformSettings
  include CampaignConcerns::MetaPlatformSettings

  belongs_to :account
  belongs_to :project
  belongs_to :website

  has_many :ad_groups, dependent: :destroy
  has_many :ads, through: :ad_groups
  has_one :project_workflow, -> { where(workflow_type: "launch") }, through: :project

  # Ad creative
  has_many :callouts, class_name: "AdCallout", dependent: :destroy
  has_one :structured_snippet, class_name: "AdStructuredSnippet", dependent: :destroy
  has_many :headlines, through: :ads, class_name: "AdHeadline"
  has_many :descriptions, through: :ads, class_name: "AdDescription"

  # Ad targeting
  has_many :keywords, through: :ad_groups, class_name: "AdKeyword"
  has_many :location_targets, class_name: "AdLocationTarget", dependent: :destroy do
    # Google Ads requires at least one positive (non-excluded) location target
    def invalid?
      targeted.empty?
    end

    def valid?
      !invalid?
    end
  end
  alias_method :location_targeting, :location_targets

  STATUSES = %w[draft active paused completed]

  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :stage, presence: true, inclusion: { in: STAGES }

  accepts_nested_attributes_for :ad_groups, allow_destroy: true
  accepts_nested_attributes_for :callouts, allow_destroy: true
  accepts_nested_attributes_for :structured_snippet, allow_destroy: true
end
