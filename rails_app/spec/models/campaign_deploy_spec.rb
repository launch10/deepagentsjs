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

  let(:account) { create(:account, :with_google_account) }
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

  describe 'campaign deploy readiness' do
    context 'when account has connected Google account' do
      it 'can proceed with create_ads_account step' do
        expect(account.has_google_connected_account?).to be true
        expect(account.google_email_address).to be_present
      end
    end

    context 'when account does not have connected Google account' do
      let(:account) { create(:account) }

      it 'cannot create Google Ads account' do
        mock_google_ads_client
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        expect(account.has_google_connected_account?).to be false
        expect { account.create_google_ads_account }.to raise_error(ArgumentError, /connected Google account/)
      end
    end
  end

  describe 'Step DSL' do
    it 'defines steps with name, run, and finished? methods' do
      step_class = CampaignDeploy::STEPS.first
      expect(step_class).to respond_to(:name)

      step_instance = step_class.new(campaign)
      expect(step_instance).to respond_to(:run)
      expect(step_instance).to respond_to(:finished?)
    end

    it 'has :create_ads_account as the first step' do
      expect(CampaignDeploy::STEPS.first.name).to eq(:create_ads_account)
    end
  end

  describe '#next_step' do
    context 'when current_step is nil' do
      it 'returns the first step instance' do
        campaign_deploy.current_step = nil
        step = campaign_deploy.next_step
        expect(step).to be_a(CampaignDeploy::Step)
        expect(step.class.step_name).to eq(:create_ads_account)
      end
    end

    context 'when current_step is the second to last' do
      it 'returns the last step' do
        steps = CampaignDeploy::STEPS
        second_to_last = steps[steps.size - 2]
        campaign_deploy.current_step = second_to_last.name.to_s
        step = campaign_deploy.next_step
        expect(step.class.step_name).to eq(steps.last.name)
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

    context 'when deploy is finished (on last step)' do
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

    context 'when step fails after running' do
      let(:mock_step) { double("Step") }

      before do
        campaign_deploy.current_step = nil
        allow(campaign_deploy).to receive(:next_step).and_return(mock_step)
        allow(mock_step).to receive(:finished?).and_return(false)
        allow(mock_step).to receive(:run)
        allow(mock_step).to receive(:class).and_return(
          double(step_name: :test_step)
        )
      end

      it 'raises an error for Sidekiq retry' do
        expect {
          campaign_deploy.actually_deploy(async: false)
        }.to raise_error(CampaignDeploy::StepNotFinishedError)
      end
    end

    context 'async mode with successful step' do
      let(:mock_step) { double("Step") }

      before do
        campaign_deploy.current_step = nil
        allow(campaign_deploy).to receive(:next_step).and_return(mock_step, nil)
        allow(mock_step).to receive(:finished?).and_return(false, true)
        allow(mock_step).to receive(:run)
        allow(mock_step).to receive(:class).and_return(
          double(step_name: :test_step)
        )
      end

      it 'enqueues another worker for the next iteration' do
        expect(CampaignDeploy::DeployWorker).to receive(:perform_async).with(campaign_deploy.id)
        campaign_deploy.actually_deploy(async: true)
      end
    end
  end

  describe CampaignDeploy::StepRunner do
    let(:runner) { described_class.new(campaign) }

    before do
      mock_google_ads_client
    end

    describe '#find' do
      it 'returns a step instance for :create_ads_account' do
        step = runner.find(:create_ads_account)
        expect(step).to be_a(CampaignDeploy::Step)
        expect(step.class.step_name).to eq(:create_ads_account)
      end

      it 'returns a step instance for :create_geo_targeting' do
        step = runner.find(:create_geo_targeting)
        expect(step).to be_a(CampaignDeploy::Step)
        expect(step.class.step_name).to eq(:create_geo_targeting)
      end
    end

    describe ':create_ads_account step' do
      let(:step) { runner.find(:create_ads_account) }

      context 'when account does not have google ads account' do
        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          allow(@mock_customer_service).to receive(:create_customer_client).and_return(
            mock_create_customer_client_response(customer_id: "9876543210")
          )
          allow(@mock_customer_service).to receive(:mutate_customer).and_return(
            mock_mutate_customer_response(customer_id: "9876543210")
          )
          allow(@mock_resource).to receive(:customer).and_yield(mock_customer_resource).and_return(mock_customer_resource)
          allow(@mock_operation).to receive(:create_resource).and_return(
            double("CreateResource", campaign_criterion: nil)
          )
          allow(@mock_update_resource).to receive(:customer).and_yield(mock_customer_resource).and_return(mock_auto_tagging_operation)
        end

        it 'creates a new Google Ads account' do
          expect(@mock_customer_service).to receive(:create_customer_client)
          step.run
        end
      end

      context 'when account already has google ads account' do
        before do
          account.create_ads_account!(google_customer_id: "123456")
          customer_client_response, auto_tagging_response = mock_verify_customer_responses(
            customer_id: 123456,
            auto_tagging_enabled: true
          )
          allow(@mock_google_ads_service).to receive(:search).and_return(
            customer_client_response,
            auto_tagging_response
          )
        end

        it 'reports finished' do
          expect(step.finished?).to be true
        end
      end
    end

    describe ':create_geo_targeting step' do
      let(:step) { runner.find(:create_geo_targeting) }
      let!(:location_target) do
        create(:ad_location_target, campaign: campaign,
          location_name: "Los Angeles",
          country_code: "US",
          location_type: "City",
          platform_settings: { "google" => { "criterion_id" => "geoTargetConstants/1013962" } })
      end

      before do
        account.create_ads_account!(google_customer_id: "456")
        campaign.update!(platform_settings: { "google" => { "campaign_id" => "789" } })
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", campaign_criterion: mock_campaign_criterion_resource)
        )
        allow(@mock_resource).to receive(:location_info).and_yield(mock_location_info_resource).and_return(mock_location_info_resource)
      end

      context 'when location targets need syncing' do
        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(
            mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 456)
          )
        end

        it 'syncs all location targets' do
          expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          step.run
        end

        it 'reports not finished before sync' do
          expect(step.finished?).to be false
        end
      end

      context 'when location targets are already synced' do
        before do
          location_target.update!(platform_settings: location_target.platform_settings.deep_merge(
            "google" => { "remote_criterion_id" => "111" }
          ))
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_campaign_criterion(
              criterion_id: 111,
              campaign_id: 789,
              customer_id: 456,
              location_id: 1013962,
              negative: false
            )
          )
        end

        it 'reports finished' do
          expect(step.finished?).to be true
        end
      end

      context 'when location targets have been deleted' do
        let!(:deleted_target) do
          target = create(:ad_location_target, campaign: campaign,
            location_name: "United States",
            country_code: "US",
            location_type: "Country",
            platform_settings: {
              "google" => {
                "criterion_id" => "geoTargetConstants/2840",
                "remote_criterion_id" => "222"
              }
            })
          target.destroy
          target
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_campaign_criterion(
              criterion_id: 222,
              campaign_id: 789,
              customer_id: 456,
              location_id: 2840,
              negative: false
            ),
            mock_empty_search_response
          )
          allow(@mock_operation).to receive(:remove_resource).and_return(
            double("RemoveResource", campaign_criterion: ->(name) { name })
          )
          allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(
            mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 456)
          )
        end

        it 'deletes the target from Google before syncing others' do
          expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).at_least(:once)
          step.run
        end

        it 'clears the remote_criterion_id after deletion' do
          step.run
          deleted_target.reload
          expect(deleted_target.google_remote_criterion_id).to be_nil
        end
      end

      context 'when deleted target does not exist in Google' do
        let!(:deleted_target) do
          target = create(:ad_location_target, campaign: campaign,
            location_name: "United States",
            country_code: "US",
            location_type: "Country",
            platform_settings: {
              "google" => {
                "criterion_id" => "geoTargetConstants/2840",
                "remote_criterion_id" => "222"
              }
            })
          target.destroy
          target
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(
            mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 456)
          )
          allow(@mock_operation).to receive(:create_resource).and_return(
            double("CreateResource", campaign_criterion: mock_campaign_criterion_resource)
          )
          allow(@mock_resource).to receive(:location_info).and_yield(mock_location_info_resource).and_return(mock_location_info_resource)
        end

        it 'handles RESOURCE_NOT_FOUND gracefully' do
          expect { step.run }.not_to raise_error
        end
      end
    end
  end
end
