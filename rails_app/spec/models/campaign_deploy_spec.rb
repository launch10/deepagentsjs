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
require 'rails_helper'

RSpec.describe CampaignDeploy, type: :model do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }
  let(:campaign_deploy) { create(:campaign_deploy, campaign: campaign) }

  describe 'validations' do
    it { should validate_presence_of(:status) }
    it { should validate_inclusion_of(:status).in_array(CampaignDeploy::STATUS) }
  end

  describe 'associations' do
    it { should belong_to(:campaign) }
  end

  describe 'statuses' do
    it 'has the same statuses as Deploy' do
      expect(CampaignDeploy::STATUS).to eq(Deploy::STATUS)
    end
  end

  describe 'Step DSL' do
    it 'defines steps with name, run, and finished? methods' do
      step = CampaignDeploy::STEPS.first
      expect(step).to respond_to(:name)
      expect(step).to respond_to(:run)
      expect(step).to respond_to(:finished?)
    end

    it 'has :create_ads_account as the first step' do
      expect(CampaignDeploy::STEPS.first.name).to eq(:create_ads_account)
    end
  end

  describe '#next_step' do
    context 'when current_step is nil' do
      it 'returns the first step' do
        campaign_deploy.current_step = nil
        expect(campaign_deploy.next_step.name).to eq(:create_ads_account)
      end
    end

    context 'when current_step is set' do
      it 'returns the step after current_step' do
        campaign_deploy.current_step = 'create_ads_account'
        expect(campaign_deploy.next_step).to be_nil
      end
    end

    context 'when on the last step' do
      it 'returns nil' do
        campaign_deploy.current_step = CampaignDeploy::STEPS.last.name.to_s
        expect(campaign_deploy.next_step).to be_nil
      end
    end
  end

  describe '#deploy' do
    it 'enqueues a DeployWorker when async: true' do
      expect(CampaignDeploy::DeployWorker).to receive(:perform_async).with(campaign_deploy.id)
      campaign_deploy.deploy(async: true)
    end

    it 'calls actually_deploy when async: false' do
      allow(campaign_deploy).to receive(:actually_deploy)
      campaign_deploy.deploy(async: false)
      expect(campaign_deploy).to have_received(:actually_deploy).with(async: false)
    end
  end

  describe '#actually_deploy' do
    before do
      mock_google_ads_client
    end

    context 'when deployfinished' do
      before do
        campaign_deploy.current_step = CampaignDeploy::STEPS.last.name.to_s
      end

      it 'marks the deploy as completed' do
        campaign_deploy.actually_deploy(async: false)
        expect(campaign_deploy.reload.status).to eq('completed')
      end

      it 'returns true' do
        expect(campaign_deploy.actually_deploy(async: false)).to be true
      end
    end

    context 'when next_step exists' do
      before do
        campaign_deploy.current_step = nil
        allow(account).to receive(:verify_google_ads_account).and_return(OpenStruct.new(success?: false))
        allow(account).to receive(:create_google_ads_account)
      end

      it 'runs the step' do
        expect(account).to receive(:create_google_ads_account)
        allow(account).to receive(:verify_google_ads_account).and_return(
          OpenStruct.new(success?: false),
          OpenStruct.new(success?: true)
        )
        campaign_deploy.actually_deploy(async: false)
      end

      it 'updates current_step after running' do
        allow(account).to receive(:verify_google_ads_account).and_return(
          OpenStruct.new(success?: false),
          OpenStruct.new(success?: true)
        )
        campaign_deploy.actually_deploy(async: false)
        expect(campaign_deploy.reload.current_step).to eq('create_ads_account')
      end
    end

    context 'when next_step exists and is already finished' do
      before do
        campaign_deploy.current_step = nil
        allow(account).to receive(:verify_google_ads_account).and_return(OpenStruct.new(success?: true))
      end

      it 'skips running the step' do
        expect(account).not_to receive(:create_google_ads_account)
        campaign_deploy.actually_deploy(async: false)
      end

      it 'still updates current_step' do
        campaign_deploy.actually_deploy(async: false)
        expect(campaign_deploy.reload.current_step).to eq('create_ads_account')
      end
    end

    context 'when step fails after running' do
      before do
        campaign_deploy.current_step = nil
        allow(account).to receive(:create_google_ads_account)
        allow(account).to receive(:verify_google_ads_account).and_return(OpenStruct.new(success?: false))
      end

      it 'raises an error for Sidekiq retry' do
        expect {
          campaign_deploy.actually_deploy(async: false)
        }.to raise_error(CampaignDeploy::StepNotFinishedError)
      end
    end

    context 'async mode' do
      before do
        campaign_deploy.current_step = nil
        allow(account).to receive(:verify_google_ads_account).and_return(
          OpenStruct.new(success?: false),
          OpenStruct.new(success?: true)
        )
        allow(account).to receive(:create_google_ads_account)
      end

      it 'enqueues another worker for the next iteration' do
        expect(CampaignDeploy::DeployWorker).to receive(:perform_async).with(campaign_deploy.id)
        campaign_deploy.actually_deploy(async: true)
      end
    end
  end
end
