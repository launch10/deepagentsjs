# == Schema Information
#
# Table name: campaigns
#
#  id                :bigint           not null, primary key
#  deleted_at        :datetime
#  end_date          :date
#  launched_at       :datetime
#  name              :string
#  platform_settings :jsonb
#  stage             :string           default("content")
#  start_date        :date
#  status            :string           default("draft")
#  time_zone         :string           default("America/New_York")
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  account_id        :bigint
#  ads_account_id    :bigint
#  project_id        :bigint
#  website_id        :bigint
#
# Indexes
#
#  index_campaigns_on_account_id             (account_id)
#  index_campaigns_on_account_id_and_stage   (account_id,stage)
#  index_campaigns_on_account_id_and_status  (account_id,status)
#  index_campaigns_on_ads_account_id         (ads_account_id)
#  index_campaigns_on_created_at             (created_at)
#  index_campaigns_on_deleted_at             (deleted_at)
#  index_campaigns_on_end_date               (end_date)
#  index_campaigns_on_google_id              ((((platform_settings -> 'google'::text) ->> 'campaign_id'::text)))
#  index_campaigns_on_launched_at            (launched_at)
#  index_campaigns_on_platform_settings      (platform_settings) USING gin
#  index_campaigns_on_project_id             (project_id)
#  index_campaigns_on_project_id_and_stage   (project_id,stage)
#  index_campaigns_on_project_id_and_status  (project_id,status)
#  index_campaigns_on_stage                  (stage)
#  index_campaigns_on_start_date             (start_date)
#  index_campaigns_on_status                 (status)
#  index_campaigns_on_website_id             (website_id)
#
class Campaign < ApplicationRecord
  include CampaignConcerns::Creation
  include CampaignConcerns::Updating
  include CampaignConcerns::Stages
  include CampaignConcerns::Scheduling
  include CampaignConcerns::LocationTargeting
  include CampaignConcerns::GooglePlatformSettings
  include CampaignConcerns::MetaPlatformSettings
  include GoogleMappable
  include GoogleSyncable

  use_google_sync GoogleAds::Campaign
  use_google_collection_sync :location_targets, GoogleAds::LocationTargets
  # ad_schedules uses class methods on GoogleAds::Resources::AdSchedule (single-file colocation)
  use_google_collection_sync :callouts, GoogleAds::Callouts
  use_google_collection_sync :structured_snippets, GoogleAds::StructuredSnippets

  # ═══════════════════════════════════════════════════════════════
  # Ad Schedule Sync - Class Method Pattern
  #
  # Uses class methods on GoogleAds::Resources::AdSchedule instead
  # of a separate syncer class (single-file colocation principle)
  # ═══════════════════════════════════════════════════════════════

  def sync_ad_schedules
    GoogleAds::Resources::AdSchedule.sync_all(self)
  end

  def ad_schedules_synced?
    GoogleAds::Resources::AdSchedule.synced?(self)
  end

  def ad_schedules_sync_plan
    GoogleAds::Resources::AdSchedule.sync_plan(self)
  end

  after_google_sync do |result|
    if result.resource_name.present?
      campaign_id = result.resource_name.split("/").last
      update_column(:platform_settings, platform_settings.deep_merge("google" => { "campaign_id" => campaign_id }))
    end
  end

  acts_as_paranoid

  belongs_to :account
  delegate :google_ads_account, to: :account
  belongs_to :project
  belongs_to :website
  belongs_to :ads_account, optional: true

  has_many :ad_groups, dependent: :destroy
  has_many :ads, through: :ad_groups
  has_many :campaign_deploys, dependent: :destroy
  has_one :launch_workflow, -> { where(workflow_type: "launch") }, through: :project, source: :workflows
  has_many :ad_schedules, dependent: :destroy
  has_one :chat, as: :contextable, class_name: "Chat"

  # Ad creative
  has_many :callouts, class_name: "AdCallout", dependent: :destroy
  has_one :structured_snippet, class_name: "AdStructuredSnippet", dependent: :destroy
  has_many :headlines, through: :ads, class_name: "AdHeadline"
  has_many :descriptions, through: :ads, class_name: "AdDescription"

  # Ad targeting
  has_many :languages, class_name: "AdLanguage", dependent: :destroy
  has_one :budget, class_name: "AdBudget", dependent: :destroy
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
  validates :time_zone, inclusion: { in: ActiveSupport::TimeZone::MAPPING.values }, allow_nil: true

  accepts_nested_attributes_for :ad_groups, allow_destroy: true
  accepts_nested_attributes_for :callouts, allow_destroy: true
  accepts_nested_attributes_for :structured_snippet, allow_destroy: true

  def daily_budget_cents
    budget&.daily_budget_cents
  end

  def daily_budget_cents=(amount)
    if amount.nil?
      budget&.destroy
      return
    end

    build_budget if budget.nil?
    budget.update!(daily_budget_cents: amount)
  end

  def thread_id
    chat&.thread_id
  end

  def google_customer_id
    account&.google_customer_id
  end

  def google_account_invitation
    account&.google_account_invitation
  end
end
