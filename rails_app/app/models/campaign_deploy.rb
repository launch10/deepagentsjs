# == Schema Information
#
# Table name: campaign_deploys
#
#  id                  :bigint           not null, primary key
#  current_step        :string
#  stacktrace          :text
#  status              :string           default("pending"), not null
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  campaign_history_id :bigint
#  campaign_id         :bigint           not null
#
# Indexes
#
#  index_campaign_deploys_on_campaign_history_id  (campaign_history_id)
#  index_campaign_deploys_on_campaign_id          (campaign_id)
#  index_campaign_deploys_on_created_at           (created_at)
#  index_campaign_deploys_on_current_step         (current_step)
#  index_campaign_deploys_on_status               (status)
#
class CampaignDeploy < ApplicationRecord
  class StepNotFinishedError < StandardError; end

  STATUS = Deploy::STATUS

  belongs_to :campaign
  validates :status, presence: true, inclusion: { in: STATUS }
  class Step
    class << self
      attr_accessor :step_name
      alias_method :name, :step_name

      def define(name, &)
        Class.new(Step) do
          self.step_name = name
          class_eval(&)
        end
      end
    end

    def initialize(campaign)
      @campaign = campaign
    end

    private

    attr_reader :campaign
  end

  class Steps
    def initialize(steps)
      @steps = steps
    end

    def find(name)
      @steps.find { |step| step.step_name.to_sym == name.to_sym }
    end

    def first
      @steps.first
    end

    def last
      @steps.last
    end

    def [](index)
      @steps[index]
    end

    def freeze
      @steps.freeze
    end

    def index(&)
      @steps.index(&)
    end

    def size
      @steps.size
    end
  end

  class StepRunner
    include TypeCheck

    def initialize(campaign)
      expect_type(campaign, Campaign)

      @campaign = campaign
      @steps = STEPS
    end

    def find(name)
      @steps.find(name).new(@campaign)
    end
  end

  # Can create a parallelizable step process here...
  # | Step | Entity         | Service                | Depends On | Parallel?    |
  # |------|----------------|------------------------|------------|--------------|
  # | 1    | Budget         | campaign_budget        | -          | -            |
  # | 2    | Campaign       | campaign               | Budget     | -            |
  # | 3a   | Geo Targeting  | campaign_criterion     | Campaign   | ✓            |
  # | 3b   | Ad Schedule    | campaign_criterion     | Campaign   | ✓            |
  # | 3c   | Assets + Links | asset + campaign_asset | Campaign   | ✓            |
  # | 4    | Ad Group       | ad_group               | Campaign   | After step 3 |
  # | 5a   | Keywords       | ad_group_criterion     | Ad Group   | ✓            |
  # | 5b   | RSA            | ad_group_ad            | Ad Group   | ✓            |
  #
  # Moreover, anything inside a group (e.g. all schedules, all criterions) can be synced in parallel
  # Needs a sharper definition of parallelizable group
  #
  STEPS = Steps.new([
    Step.define(:create_ads_account) do
      def run
        campaign.account.create_google_ads_account
      end

      def finished?
        sync_result&.success? || false
      end

      def sync_result
        campaign.account.verify_google_ads_account
      end
    end,

    Step.define(:send_account_invitation) do
      def run
        campaign.google_ads_account.send_google_ads_invitation_email
      end

      def finished?
        sync_result&.success? || false
      end

      def sync_result
        campaign&.account&.google_account_invitation&.google_sync_result
      end
    end,

    Step.define(:sync_budget) do
      def run
        campaign.budget.google_sync
      end

      def finished?
        sync_result&.success? || false
      end

      def sync_result
        campaign.budget.google_sync_result
      end
    end,

    Step.define(:create_campaign) do
      def run
        campaign.google_sync
      end

      def finished?
        sync_result&.success? || false
      end

      def sync_result
        campaign.google_sync_result
      end
    end,

    Step.define(:create_geo_targeting) do
      def run
        campaign.sync_location_targets
      end

      def finished?
        campaign.location_targets_synced?
      end

      def sync_result
        campaign.location_targets_sync_result
      end
    end,

    Step.define(:create_schedule) do
      def run
        campaign.sync_ad_schedules
      end

      def finished?
        campaign.ad_schedules_synced?
      end

      def sync_result
        campaign.ad_schedules_sync_result
      end
    end,

    Step.define(:create_assets) do
      def run
        campaign.sync_callouts
        campaign.sync_structured_snippets
      end

      def finished?
        campaign.callouts_synced? && campaign.structured_snippets_synced?
      end

      def sync_result
        [campaign.callouts_sync_result, campaign.structured_snippets_sync_result]
      end
    end,

    Step.define(:create_ad_groups) do
      def run
        campaign.ad_groups.each(&:sync)
      end

      def finished?
        campaign.ad_groups.all?(&:synced?)
      end
    end,

    Step.define(:create_keywords) do
      def run
        campaign.ad_groups.each(&:sync_keywords)
      end

      def finished?
        campaign.ad_groups.all?(&:keywords_synced?)
      end

      def sync_result
        campaign.ad_groups.map(&:keywords_sync_result)
      end
    end,

    Step.define(:create_ads) do
      def run
        campaign.ads.each(&:sync)
      end

      def finished?
        campaign.ads.all?(&:synced?)
      end
    end
  ])

  def next_step
    step_class = if current_step.nil?
      STEPS.first
    else
      current_index = STEPS.index { |s| s.name.to_s == current_step }
      return nil if current_index.nil?
      STEPS[current_index + 1]
    end

    return nil if step_class.nil?
    step_class.new(campaign)
  end

  def deploy(async: true)
    if async
      CampaignDeploy::DeployWorker.perform_async(id)
    else
      actually_deploy(async: false)
    end
  end

  def actually_deploy(async: true)
    step = next_step

    if step.nil?
      update!(status: "completed")
      return true
    end

    step.run unless step.finished?
    update!(current_step: step.class.step_name.to_s)

    unless step.finished?
      raise StepNotFinishedError, "Step #{step.class.step_name} did not complete successfully"
    end

    if async
      CampaignDeploy::DeployWorker.perform_async(id)
    else
      actually_deploy(async: false)
    end
  end
end
