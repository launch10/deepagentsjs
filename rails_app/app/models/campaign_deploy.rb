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
    def initialize(campaign)
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
        campaign.account.verify_google_ads_account&.success?
      end
    end,

    Step.define(:sync_budget) do
      def run
        campaign.budget.google_sync
      end

      def finished?
        campaign.budget.google_synced?
      end
    end,

    Step.define(:create_campaign) do
      def run
        campaign.sync
      end

      def finished?
        campaign.synced?
      end
    end,

    Step.define(:create_geo_targeting) do
      def run
        campaign.location_targets.each(&:sync)
      end

      def finished?
        campaign.location_targets.all?(&:synced?)
      end
    end,

    Step.define(:create_schedule) do
      def run
        campaign.ad_schedules.each(&:sync)
      end

      def finished?
        campaign.ad_schedules.all?(&:synced?)
      end
    end,

    # callouts, snippets, favicon...
    Step.define(:create_assets) do
      def run
        campaign.assets.each(&:sync)
      end

      def finished?
        campaign.assets.all?(&:synced?)
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
        campaign.keywords.each(&:sync)
      end

      def finished?
        campaign.keywords.all?(&:synced?)
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
    return STEPS.first if current_step.nil?

    current_index = STEPS.index { |s| s.name.to_s == current_step }
    return nil if current_index.nil?

    STEPS[current_index + 1]
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

    context = build_context

    step.run(context) unless step.finished?(context)
    update!(current_step: step.name.to_s)

    unless step.finished?(context)
      raise StepNotFinishedError, "Step #{step.name} did not complete successfully"
    end

    if async
      CampaignDeploy::DeployWorker.perform_async(id)
    else
      actually_deploy(async: false)
    end
  end

  private

  def build_context
    { account: campaign.account, campaign: campaign }
  end
end
