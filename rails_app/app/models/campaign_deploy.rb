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
class CampaignDeploy < ApplicationRecord
  acts_as_paranoid

  include Lockable

  class StepNotFinishedError < StandardError; end

  class DeployInProgressError < StandardError; end

  STATUS = WebsiteDeploy::STATUS

  belongs_to :campaign
  validates :status, presence: true, inclusion: { in: STATUS }

  scope :in_progress, -> { where(status: %w[pending]) }

  def self.deploy(campaign, async: true, job_run_id: nil)
    lock_key = "campaign_deploy:#{campaign.id}"

    # Lock only for check + create; release before running deploy
    campaign_deploy = with_lock(lock_key, wait_timeout: 0.5, stale_timeout: 30.seconds.to_i) do
      if campaign.campaign_deploys.in_progress.exists?
        raise DeployInProgressError, "A deploy is already in progress for campaign #{campaign.id}"
      end

      create!(campaign: campaign, status: "pending")
    end

    campaign_deploy.deploy(async: async, job_run_id: job_run_id)
    campaign_deploy
  end

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
      unless campaign.done_launch_stage?
        raise "Cannot deploy campaign that has not completed launch stage"
      end

      @campaign = campaign
      @steps = STEPS
    end

    def find(name)
      @steps.find(name).new(@campaign)
    end

    def reload
      @campaign.reload
      self
    end

    # Returns a merged plan of all operations across all steps
    # This is a "dry run" capability - showing what would happen without executing
    def plan
      step_plans = @steps.instance_variable_get(:@steps).map do |step_class|
        step_class.new(@campaign).sync_plan
      end

      GoogleAds::Sync::Plan.merge(*step_plans)
    end
  end

  # TODO:
  # Can create a parallelizable step process here...
  #
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
  #
  # This could be done by using enqueuing sync_plans
  #
  STEPS = Steps.new([
    # We're actually going to separate these - they're one time verifications and the frontend/Langgraph will be in charge of orchestrating them
    #
    # Step.define(:create_ads_account) do
    #   def ready?
    #     campaign.account.has_google_connected_account?
    #   end

    #   def run
    #     campaign.account.create_google_ads_account
    #   end

    #   def finished?
    #     sync_result&.success? || false
    #   end

    #   def sync_result
    #     campaign.account.verify_google_ads_account
    #   end
    # end,

    # Step.define(:send_account_invitation) do
    #   def ready?
    #     campaign.google_ads_account.present? && campaign.account.google_account_invitation.nil?
    #   end

    #   def run
    #     campaign.google_ads_account.send_google_ads_invitation_email
    #   end

    #   # Will be false if user declines invitation, for example, allowing us to send another invitation
    #   def finished?
    #     campaign&.account&.google_account_invitation&.okay? || false
    #   end

    #   def sync_result
    #     campaign&.account&.google_account_invitation&.google_sync_result
    #   end
    # end,

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

      def sync_plan
        GoogleAds::Resources::Budget.sync_plan(campaign)
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

      def sync_plan
        GoogleAds::Resources::Campaign.new(campaign).sync_plan
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

      def sync_plan
        GoogleAds::Resources::LocationTarget.sync_plan(campaign)
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

      def sync_plan
        GoogleAds::Resources::AdSchedule.sync_plan(campaign)
      end
    end,

    Step.define(:create_callouts) do
      def run
        campaign.sync_callouts
      end

      def finished?
        campaign.callouts_synced?
      end

      def sync_result
        campaign.callouts_sync_result
      end

      def sync_plan
        GoogleAds::Resources::Callout.sync_plan(campaign)
      end
    end,

    Step.define(:create_structured_snippets) do
      def run
        campaign.sync_structured_snippets
      end

      def finished?
        campaign.structured_snippets_synced?
      end

      def sync_result
        campaign.structured_snippets_sync_result
      end

      def sync_plan
        GoogleAds::Resources::StructuredSnippet.sync_plan(campaign)
      end
    end,

    Step.define(:create_ad_groups) do
      def run
        campaign.ad_groups.map(&:google_sync)
      end

      def finished?
        campaign.ad_groups.all?(&:google_synced?)
      end

      def sync_result
        campaign.ad_groups.map(&:google_sync_result)
      end

      def sync_plan
        GoogleAds::Resources::AdGroup.sync_plan(campaign)
      end
    end,

    Step.define(:create_keywords) do
      def run
        campaign.ad_groups.map(&:sync_keywords)
      end

      def finished?
        campaign.ad_groups.all?(&:keywords_synced?)
      end

      def sync_result
        campaign.ad_groups.map(&:keywords_sync_result)
      end

      def sync_plan
        plans = campaign.ad_groups.map { |ad_group| GoogleAds::Resources::Keyword.sync_plan(ad_group) }
        GoogleAds::Sync::Plan.merge(*plans)
      end
    end,

    Step.define(:create_ads) do
      def run
        campaign.ads.map(&:google_sync)
      end

      def finished?
        campaign.ads.all?(&:google_synced?)
      end

      def sync_result
        campaign.ads.map(&:google_sync_result)
      end

      def sync_plan
        plans = campaign.ad_groups.map { |ad_group| GoogleAds::Resources::Ad.sync_plan(ad_group) }
        GoogleAds::Sync::Plan.merge(*plans)
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

  def deploy(async: true, job_run_id: nil)
    if async
      CampaignDeploy::DeployWorker.perform_async(id, job_run_id)
    else
      actually_deploy(async: false, job_run_id: job_run_id)
    end
  end

  # Runs a single step and either enqueues next iteration or returns completion status
  # Returns true when ALL steps are complete, false otherwise
  def actually_deploy(async: true, job_run_id: nil)
    lock_key = "campaign_deploy:#{campaign_id}"

    self.class.with_lock(lock_key, wait_timeout: 5, stale_timeout: 10.minutes.to_i) do
      step = next_step

      if step.nil?
        update!(status: "completed")

        account = campaign&.account
        TrackEvent.call("campaign_deployed",
          user: account&.owner,
          account: account,
          project: campaign&.project,
          campaign: campaign,
          project_uuid: campaign&.project&.uuid,
          deploy_status: "completed",
          daily_budget_cents: campaign&.daily_budget_cents)

        return true  # All steps complete
      end

      step.run unless step.finished?
      update!(current_step: step.class.step_name.to_s)

      unless step.finished? # There was some API error that prevented us from successfully completing the task, retry
        raise StepNotFinishedError, "Step #{step.class.step_name} did not complete successfully"
      end
    end

    # Enqueue next step outside the lock to avoid holding it during queue operations
    if async
      CampaignDeploy::DeployWorker.perform_async(id, job_run_id)
    else
      actually_deploy(async: false, job_run_id: job_run_id)
    end

    false  # More steps remain (we just enqueued/recursed)
  end
end
