require 'rails_helper'

RSpec.describe CampaignDeployWorker, type: :worker do
  let(:account) { create(:account) }
  let(:website) { create(:website, account: account) }
  let(:campaign) { create(:campaign, account: account, website: website) }
  let(:job_run) do
    create(:job_run,
      :with_langgraph_callback,
      account: account,
      job_class: "CampaignDeployWorker",
      job_args: { account_id: account.id, campaign_id: campaign.id })
  end

  describe "#perform" do
    context "when job_run exists and campaign is valid" do
      it "deploys the campaign and completes the job run" do
        # Mock the CampaignDeployService
        deploy_result = double(external_id: "ext_123", platform: "google", deployed_at: Time.current)
        expect(CampaignDeployService).to receive(:call).with(campaign: campaign).and_return(deploy_result)

        expect(LanggraphCallbackWorker).to receive(:perform_async).with(
          job_run.id,
          hash_including(
            status: "completed",
            result: hash_including(
              campaign_id: campaign.id,
              external_id: "ext_123"
            )
          )
        )

        CampaignDeployWorker.new.perform(job_run.id)

        job_run.reload
        expect(job_run.status).to eq("completed")
        expect(job_run.result_data["campaign_id"]).to eq(campaign.id)
      end
    end

    context "when job_run does not exist" do
      it "returns early without error" do
        expect {
          CampaignDeployWorker.new.perform(999999)
        }.not_to raise_error
      end
    end

    context "when campaign is not found" do
      let(:job_run) do
        create(:job_run,
          :with_langgraph_callback,
          account: account,
          job_class: "CampaignDeployWorker",
          job_args: { account_id: account.id, campaign_id: 999999 })
      end

      it "fails the job run with an error" do
        expect(LanggraphCallbackWorker).to receive(:perform_async).with(
          job_run.id,
          hash_including(status: "failed")
        )

        expect {
          CampaignDeployWorker.new.perform(job_run.id)
        }.to raise_error(ActiveRecord::RecordNotFound)

        job_run.reload
        expect(job_run.status).to eq("failed")
      end
    end

    context "when CampaignDeployService fails" do
      it "fails the job run and re-raises for Sidekiq retry" do
        expect(CampaignDeployService).to receive(:call).and_raise(StandardError, "Deployment failed")

        expect(LanggraphCallbackWorker).to receive(:perform_async).with(
          job_run.id,
          hash_including(status: "failed", error: "Deployment failed")
        )

        expect {
          CampaignDeployWorker.new.perform(job_run.id)
        }.to raise_error(StandardError, "Deployment failed")

        job_run.reload
        expect(job_run.status).to eq("failed")
      end
    end
  end
end
