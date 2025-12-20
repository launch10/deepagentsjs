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

      def define(name, &block)
        Class.new(Step) do
          self.step_name = name
          class_eval(&block)
        end
      end
    end

    def initialize(campaign)
      @campaign = campaign
    end

    private

    attr_reader :campaign
  end

  STEPS = [
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
        campaign.budget.sync
      end

      def finished?
        campaign.budget.synced?
      end
    end
  ].freeze


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
