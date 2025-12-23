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
          account.create_ads_account!(platform: "google", google_customer_id: "123456")
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
        account.create_ads_account!(platform: "google", google_customer_id: "456")
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
          mock_remove_resource = double("RemoveResource")
          allow(mock_remove_resource).to receive(:campaign_criterion).and_return("remove_operation")
          allow(@mock_operation).to receive(:remove_resource).and_return(mock_remove_resource)
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

      context 'with mixed add/update/delete scenario' do
        let!(:existing_synced_target) do
          create(:ad_location_target, campaign: campaign,
            location_name: "New York",
            country_code: "US",
            location_type: "City",
            platform_settings: {
              "google" => {
                "criterion_id" => "geoTargetConstants/1023191",
                "remote_criterion_id" => "333"
              }
            })
        end

        let!(:new_target) do
          create(:ad_location_target, campaign: campaign,
            location_name: "Chicago",
            country_code: "US",
            location_type: "City",
            platform_settings: { "google" => { "criterion_id" => "geoTargetConstants/1014895" } })
        end

        let!(:deleted_target) do
          target = create(:ad_location_target, campaign: campaign,
            location_name: "Boston",
            country_code: "US",
            location_type: "City",
            platform_settings: {
              "google" => {
                "criterion_id" => "geoTargetConstants/1018127",
                "remote_criterion_id" => "444"
              }
            })
          target.destroy
          target
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_campaign_criterion(criterion_id: 333, campaign_id: 789, customer_id: 456, location_id: 1023191),
            mock_search_response_with_campaign_criterion(criterion_id: 444, campaign_id: 789, customer_id: 456, location_id: 1018127),
            mock_empty_search_response
          )
          mock_remove_resource = double("RemoveResource")
          allow(mock_remove_resource).to receive(:campaign_criterion).and_return("remove_operation")
          allow(@mock_operation).to receive(:remove_resource).and_return(mock_remove_resource)
          allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(
            mock_mutate_campaign_criterion_response(criterion_id: 555, campaign_id: 789, customer_id: 456)
          )
        end

        it 'deletes removed targets and creates new ones' do
          expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).at_least(:twice)
          step.run
        end

        it 'clears remote_criterion_id on deleted target' do
          step.run
          expect(deleted_target.reload.google_remote_criterion_id).to be_nil
        end

        it 'sets remote_criterion_id on new target' do
          step.run
          expect(new_target.reload.google_remote_criterion_id).to eq("555")
        end
      end
    end

    describe ':send_account_invitation step' do
      let(:step) { runner.find(:send_account_invitation) }
      let!(:ads_account) { account.create_ads_account!(platform: "google", google_customer_id: "456") }

      before do
        mock_customer_user_access_invitation_service
        allow(@mock_resource).to receive(:customer_user_access_invitation)
          .and_yield(mock_customer_user_access_invitation_resource)
          .and_return(mock_customer_user_access_invitation_resource)
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", customer_user_access_invitation: mock_customer_user_access_invitation_resource)
        )
      end

      context 'when invitation has not been sent' do
        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          allow(@mock_customer_user_access_invitation_service).to receive(:mutate_customer_user_access_invitation).and_return(
            mock_mutate_customer_user_access_invitation_response(invitation_id: 12345, customer_id: 456)
          )
        end

        it 'sends the invitation' do
          expect(@mock_customer_user_access_invitation_service).to receive(:mutate_customer_user_access_invitation)
          step.run
        end

        it 'reports not finished before sending' do
          expect(step.finished?).to be false
        end
      end

      context 'when invitation has already been sent' do
        let!(:invitation) do
          create(:ads_account_invitation, :sent,
            ads_account: ads_account,
            email_address: account.google_email_address)
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_invitation(invitation_id: invitation.google_invitation_id, customer_id: 456, email_address: account.google_email_address)
          )
        end

        it 'reports finished' do
          expect(step.finished?).to be true
        end
      end
    end

    describe ':sync_budget step' do
      let(:step) { runner.find(:sync_budget) }
      let!(:ads_account) { account.create_ads_account!(platform: "google", google_customer_id: "456") }
      let!(:budget) { create(:ad_budget, campaign: campaign, daily_budget_cents: 500) }

      before do
        allow(@mock_resource).to receive(:campaign_budget).and_yield(mock_budget_resource).and_return(mock_budget_resource)
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", campaign_budget: mock_budget_resource)
        )
      end

      context 'when budget needs syncing' do
        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          allow(@mock_campaign_budget_service).to receive(:mutate_campaign_budgets).and_return(
            mock_mutate_budget_response(budget_id: 123, customer_id: 456)
          )
        end

        it 'creates the budget in Google' do
          expect(@mock_campaign_budget_service).to receive(:mutate_campaign_budgets)
          step.run
        end

        it 'reports not finished before sync' do
          expect(step.finished?).to be false
        end
      end

      context 'when budget is already synced' do
        before do
          budget.update!(platform_settings: { "google" => { "budget_id" => "123" } })
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_budget(budget_id: 123, amount_micros: budget.daily_budget_cents * 10_000)
          )
        end

        it 'reports finished' do
          expect(step.finished?).to be true
        end
      end
    end

    describe ':create_campaign step' do
      let(:step) { runner.find(:create_campaign) }
      let!(:ads_account) { account.create_ads_account!(platform: "google", google_customer_id: "456") }
      let!(:budget) { create(:ad_budget, campaign: campaign, daily_budget_cents: 500, platform_settings: { "google" => { "budget_id" => "123" } }) }

      before do
        allow(@mock_resource).to receive(:campaign).and_yield(mock_campaign_resource).and_return(mock_campaign_resource)
        allow(@mock_resource).to receive(:network_settings).and_return(double("NetworkSettings").tap do |ns|
          allow(ns).to receive(:target_google_search=)
          allow(ns).to receive(:target_search_network=)
          allow(ns).to receive(:target_content_network=)
          allow(ns).to receive(:target_partner_search_network=)
        end)
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", campaign: mock_campaign_resource)
        )
      end

      context 'when campaign needs syncing' do
        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          allow(@mock_campaign_service).to receive(:mutate_campaigns).and_return(
            mock_mutate_campaign_response(campaign_id: 789, customer_id: 456)
          )
        end

        it 'creates the campaign in Google' do
          expect(@mock_campaign_service).to receive(:mutate_campaigns)
          step.run
        end

        it 'reports not finished before sync' do
          expect(step.finished?).to be false
        end
      end

      context 'when campaign is already synced' do
        before do
          campaign.update!(platform_settings: { "google" => { "campaign_id" => "789" } })
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_campaign(campaign_id: 789, customer_id: 456)
          )
        end

        it 'reports finished' do
          expect(step.finished?).to be true
        end
      end
    end

    describe ':create_schedule step' do
      let(:step) { runner.find(:create_schedule) }
      let!(:ads_account) { account.create_ads_account!(platform: "google", google_customer_id: "456") }

      before do
        campaign.update!(platform_settings: { "google" => { "campaign_id" => "789" } })
        allow(@mock_resource).to receive(:ad_schedule_info).and_yield(mock_ad_schedule_info_resource).and_return(mock_ad_schedule_info_resource)
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", campaign_criterion: mock_campaign_criterion_with_ad_schedule_resource)
        )
      end

      context 'when ad schedules need syncing' do
        let!(:schedule) do
          create(:ad_schedule, campaign: campaign, day_of_week: "Monday", start_hour: 9, end_hour: 17)
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(
            mock_mutate_campaign_criterion_response(criterion_id: 222, campaign_id: 789, customer_id: 456)
          )
        end

        it 'syncs all ad schedules' do
          expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          step.run
        end

        it 'reports not finished before sync' do
          expect(step.finished?).to be false
        end
      end

      context 'when ad schedules are already synced' do
        let!(:schedule) do
          create(:ad_schedule, campaign: campaign,
            day_of_week: "Monday", start_hour: 9, end_hour: 17,
            platform_settings: { "google" => { "criterion_id" => "222" } })
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_ad_schedule(criterion_id: 222, campaign_id: 789, customer_id: 456)
          )
        end

        it 'reports finished' do
          expect(step.finished?).to be true
        end
      end

      context 'with mixed add/delete scenario' do
        let!(:existing_schedule) do
          create(:ad_schedule, campaign: campaign,
            day_of_week: "Monday", start_hour: 9, end_hour: 17,
            platform_settings: { "google" => { "criterion_id" => "222" } })
        end

        let!(:new_schedule) do
          create(:ad_schedule, campaign: campaign,
            day_of_week: "Tuesday", start_hour: 10, end_hour: 18)
        end

        let!(:deleted_schedule) do
          schedule = create(:ad_schedule, campaign: campaign,
            day_of_week: "Wednesday", start_hour: 8, end_hour: 16,
            platform_settings: { "google" => { "criterion_id" => "333" } })
          schedule.destroy
          schedule
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_ad_schedule(criterion_id: 222, campaign_id: 789, customer_id: 456),
            mock_search_response_with_ad_schedule(criterion_id: 333, campaign_id: 789, customer_id: 456, day_of_week: :WEDNESDAY),
            mock_empty_search_response
          )
          mock_remove_resource = double("RemoveResource")
          allow(mock_remove_resource).to receive(:campaign_criterion).and_return("remove_operation")
          allow(@mock_operation).to receive(:remove_resource).and_return(mock_remove_resource)
          allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(
            mock_mutate_campaign_criterion_response(criterion_id: 444, campaign_id: 789, customer_id: 456)
          )
        end

        it 'deletes removed schedules and creates new ones' do
          expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).at_least(:twice)
          step.run
        end

        it 'clears criterion_id on deleted schedule' do
          step.run
          expect(deleted_schedule.reload.google_criterion_id).to be_nil
        end
      end
    end

    describe ':create_assets step' do
      let(:step) { runner.find(:create_assets) }
      let!(:ads_account) { account.create_ads_account!(platform: "google", google_customer_id: "456") }
      let!(:ad_group) { create(:ad_group, campaign: campaign) }

      before do
        campaign.update!(ads_account: ads_account, platform_settings: { "google" => { "campaign_id" => "789" } })
        allow(@mock_resource).to receive(:asset).and_yield(mock_asset_with_callout_resource).and_return(mock_asset_with_callout_resource)
        allow(@mock_resource).to receive(:callout_asset).and_yield(mock_callout_asset_resource).and_return(mock_callout_asset_resource)
        allow(@mock_resource).to receive(:structured_snippet_asset).and_yield(mock_structured_snippet_asset_resource).and_return(mock_structured_snippet_asset_resource)
        allow(@mock_resource).to receive(:campaign_asset).and_yield(mock_campaign_asset_resource).and_return(mock_campaign_asset_resource)
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", asset: mock_asset_with_callout_resource, campaign_asset: mock_campaign_asset_resource)
        )
      end

      context 'when callouts need syncing' do
        let!(:callout) { create(:ad_callout, campaign: campaign, ad_group: ad_group, text: "Free Shipping") }

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          allow(@mock_asset_service).to receive(:mutate_assets).and_return(
            mock_mutate_asset_response(asset_id: 88888, customer_id: 456)
          )
          allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets).and_return(
            mock_mutate_campaign_asset_response(asset_id: 88888, campaign_id: 789, customer_id: 456)
          )
        end

        it 'syncs callouts' do
          expect(@mock_asset_service).to receive(:mutate_assets)
          step.run
        end

        it 'reports not finished before sync' do
          expect(step.finished?).to be false
        end
      end

      context 'when structured snippets need syncing' do
        let!(:snippet) { create(:ad_structured_snippet, campaign: campaign, category: "brands", values: ["Nike", "Adidas", "Puma"]) }

        before do
          allow(@mock_resource).to receive(:asset).and_yield(mock_asset_with_structured_snippet_resource).and_return(mock_asset_with_structured_snippet_resource)
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          allow(@mock_asset_service).to receive(:mutate_assets).and_return(
            mock_mutate_asset_response(asset_id: 99999, customer_id: 456)
          )
          allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets).and_return(
            mock_mutate_campaign_asset_response(asset_id: 99999, campaign_id: 789, customer_id: 456)
          )
        end

        it 'syncs structured snippets' do
          expect(@mock_asset_service).to receive(:mutate_assets)
          step.run
        end
      end

      context 'when all assets are already synced' do
        let!(:callout) do
          create(:ad_callout, campaign: campaign, ad_group: ad_group, text: "Free Shipping",
            platform_settings: { "google" => { "asset_id" => "88888", "campaign_asset_id" => "789~88888" } })
        end
        let!(:snippet) do
          create(:ad_structured_snippet, campaign: campaign, category: "brands", values: ["Nike", "Adidas", "Puma"],
            platform_settings: { "google" => { "asset_id" => "99999", "campaign_asset_id" => "789~99999" } })
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_callout_asset(asset_id: 88888, customer_id: 456, callout_text: "Free Shipping"),
            mock_search_response_with_structured_snippet_asset(asset_id: 99999, customer_id: 456, header: "Brands", values: ["Nike", "Adidas", "Puma"])
          )
        end

        it 'reports finished' do
          expect(step.finished?).to be true
        end
      end
    end

    describe ':create_ad_groups step' do
      let(:step) { runner.find(:create_ad_groups) }
      let!(:ads_account) { account.create_ads_account!(platform: "google", google_customer_id: "456") }

      before do
        campaign.update!(ads_account: ads_account, platform_settings: { "google" => { "campaign_id" => "789" } })
        allow(@mock_resource).to receive(:ad_group).and_yield(mock_ad_group_resource).and_return(mock_ad_group_resource)
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", ad_group: mock_ad_group_resource)
        )
      end

      context 'when ad groups need syncing' do
        let!(:ad_group) { create(:ad_group, campaign: campaign, name: "Test Ad Group") }

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          allow(@mock_ad_group_service).to receive(:mutate_ad_groups).and_return(
            mock_mutate_ad_group_response(ad_group_id: 999, customer_id: 456)
          )
        end

        it 'syncs all ad groups' do
          expect(@mock_ad_group_service).to receive(:mutate_ad_groups)
          step.run
        end

        it 'reports not finished before sync' do
          expect(step.finished?).to be false
        end
      end

      context 'when ad groups are already synced' do
        let!(:ad_group) do
          create(:ad_group, campaign: campaign, name: "Test Ad Group",
            platform_settings: { "google" => { "ad_group_id" => "999" } })
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_ad_group(ad_group_id: 999, customer_id: 456, name: "Test Ad Group")
          )
        end

        it 'reports finished' do
          expect(step.finished?).to be true
        end
      end
    end

    describe ':create_keywords step' do
      let(:step) { runner.find(:create_keywords) }
      let!(:ads_account) { account.create_ads_account!(platform: "google", google_customer_id: "456") }
      let!(:ad_group) do
        create(:ad_group, campaign: campaign, name: "Test Ad Group",
          platform_settings: { "google" => { "ad_group_id" => "999" } })
      end

      before do
        campaign.update!(ads_account: ads_account, platform_settings: { "google" => { "campaign_id" => "789" } })
        allow(@mock_resource).to receive(:ad_group_criterion).and_yield(mock_ad_group_criterion_resource).and_return(mock_ad_group_criterion_resource)
        allow(@mock_resource).to receive(:keyword_info).and_yield(mock_keyword_info_resource).and_return(mock_keyword_info_resource)
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", ad_group_criterion: mock_ad_group_criterion_resource)
        )
      end

      context 'when keywords need syncing' do
        let!(:keyword) { create(:ad_keyword, ad_group: ad_group, text: "test keyword", match_type: "broad") }

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria).and_return(
            mock_mutate_ad_group_criterion_response(criterion_id: 333, ad_group_id: 999, customer_id: 456)
          )
        end

        it 'syncs all keywords' do
          expect(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
          step.run
        end

        it 'reports not finished before sync' do
          expect(step.finished?).to be false
        end
      end

      context 'when keywords are already synced' do
        let!(:keyword) do
          create(:ad_keyword, ad_group: ad_group, text: "test keyword", match_type: "broad",
            platform_settings: { "google" => { "criterion_id" => "333" } })
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_keyword(criterion_id: 333, ad_group_id: 999, customer_id: 456, keyword_text: "test keyword")
          )
        end

        it 'reports finished' do
          expect(step.finished?).to be true
        end
      end

      context 'with mixed add/delete scenario' do
        let!(:existing_keyword) do
          create(:ad_keyword, ad_group: ad_group, text: "existing keyword", match_type: "broad",
            platform_settings: { "google" => { "criterion_id" => "333" } })
        end

        let!(:new_keyword) do
          create(:ad_keyword, ad_group: ad_group, text: "new keyword", match_type: "exact")
        end

        let!(:deleted_keyword) do
          keyword = create(:ad_keyword, ad_group: ad_group, text: "deleted keyword", match_type: "phrase",
            platform_settings: { "google" => { "criterion_id" => "444" } })
          keyword.destroy
          keyword
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_keyword(criterion_id: 333, ad_group_id: 999, customer_id: 456, keyword_text: "existing keyword", match_type: :BROAD),
            mock_search_response_with_keyword(criterion_id: 444, ad_group_id: 999, customer_id: 456, keyword_text: "deleted keyword"),
            mock_empty_search_response
          )
          mock_remove_resource = double("RemoveResource")
          allow(mock_remove_resource).to receive(:ad_group_criterion).and_return("remove_operation")
          allow(@mock_operation).to receive(:remove_resource).and_return(mock_remove_resource)
          allow(@mock_update_resource).to receive(:ad_group_criterion).and_yield(mock_ad_group_criterion_resource).and_return(mock_ad_group_criterion_resource)
          allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria).and_return(
            mock_mutate_ad_group_criterion_response(criterion_id: 555, ad_group_id: 999, customer_id: 456)
          )
        end

        it 'deletes removed keywords and creates new ones' do
          expect(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria).at_least(:twice)
          step.run
        end

        it 'clears criterion_id on deleted keyword' do
          step.run
          expect(deleted_keyword.reload.google_criterion_id).to be_nil
        end

        it 'sets criterion_id on new keyword' do
          step.run
          expect(new_keyword.reload.google_criterion_id).to eq("555")
        end
      end
    end

    describe ':create_ads step' do
      let(:step) { runner.find(:create_ads) }
      let!(:ads_account) { account.create_ads_account!(platform: "google", google_customer_id: "456") }
      let!(:ad_group) do
        create(:ad_group, campaign: campaign, name: "Test Ad Group",
          platform_settings: { "google" => { "ad_group_id" => "999" } })
      end

      before do
        campaign.update!(ads_account: ads_account, platform_settings: { "google" => { "campaign_id" => "789" } })
        allow(@mock_resource).to receive(:ad_group_ad).and_yield(mock_ad_group_ad_resource).and_return(mock_ad_group_ad_resource)
        allow(@mock_resource).to receive(:ad).and_yield(mock_ad_resource).and_return(mock_ad_resource)
        allow(@mock_resource).to receive(:responsive_search_ad_info).and_yield(mock_responsive_search_ad_info_resource).and_return(mock_responsive_search_ad_info_resource)
        allow(@mock_resource).to receive(:ad_text_asset).and_yield(mock_ad_text_asset_resource).and_return(mock_ad_text_asset_resource)
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", ad_group_ad: mock_ad_group_ad_resource)
        )
      end

      context 'when ads need syncing' do
        let!(:ad) { create(:ad, ad_group: ad_group, status: "draft") }

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          allow(@mock_ad_group_ad_service).to receive(:mutate_ad_group_ads).and_return(
            mock_mutate_ad_group_ad_response(ad_id: 12345, ad_group_id: 999, customer_id: 456)
          )
        end

        it 'syncs all ads' do
          expect(@mock_ad_group_ad_service).to receive(:mutate_ad_group_ads)
          step.run
        end

        it 'reports not finished before sync' do
          expect(step.finished?).to be false
        end
      end

      context 'when ads are already synced' do
        let!(:ad) do
          create(:ad, ad_group: ad_group, status: "active",
            platform_settings: { "google" => { "ad_id" => "12345" } })
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_ad_group_ad(ad_id: 12345, ad_group_id: 999, customer_id: 456, status: :ENABLED)
          )
        end

        it 'reports finished' do
          expect(step.finished?).to be true
        end
      end
    end
  end
end
