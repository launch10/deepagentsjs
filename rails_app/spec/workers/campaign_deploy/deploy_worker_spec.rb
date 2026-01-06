require 'rails_helper'

RSpec.describe CampaignDeploy::DeployWorker, type: :worker do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }
  let(:campaign_deploy) { create(:campaign_deploy, campaign: campaign) }

  describe '#perform' do
    before do
      mock_google_ads_client
    end

    it 'calls actually_deploy on the campaign_deploy' do
      allow(CampaignDeploy).to receive(:find).with(campaign_deploy.id).and_return(campaign_deploy)
      expect(campaign_deploy).to receive(:actually_deploy)
      described_class.new.perform(campaign_deploy.id)
    end

    context 'when deploy fails' do
      it 'raises an error for Sidekiq retry' do
        allow(CampaignDeploy).to receive(:find).with(campaign_deploy.id).and_return(campaign_deploy)
        allow(campaign_deploy).to receive(:actually_deploy).and_raise(CampaignDeploy::StepNotFinishedError)

        expect {
          described_class.new.perform(campaign_deploy.id)
        }.to raise_error(CampaignDeploy::StepNotFinishedError)
      end
    end
  end

  describe 'sidekiq_retries_exhausted' do
    it 'marks the deploy as failed when retries are exhausted' do
      msg = { 'args' => [campaign_deploy.id], 'retry_count' => 5 }
      ex = StandardError.new('Test error')

      described_class.sidekiq_retries_exhausted_block.call(msg, ex)

      expect(campaign_deploy.reload.status).to eq('failed')
    end
  end
end
