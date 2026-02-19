# == Schema Information
#
# Table name: campaign_deploys
#
#  id                  :bigint           not null, primary key
#  current_step        :string
#  deleted_at          :datetime
#  shasum              :string
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
#  index_campaign_deploys_on_shasum                  (shasum)
#  index_campaign_deploys_on_status                  (status)
#
require 'rails_helper'

RSpec.describe CampaignDeploy, type: :model do
  include GoogleAdsMocks

  let(:account) { create(:account, :with_google_account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }
  let(:campaign_deploy) { create(:campaign_deploy, campaign: campaign) }

  before do
    allow_any_instance_of(Campaign).to receive(:done_launch_stage?).and_return(true)
  end

  describe 'validations' do
    it { should validate_presence_of(:status) }
    it { should validate_inclusion_of(:status).in_array(CampaignDeploy::STATUS) }
  end

  describe 'associations' do
    it { should belong_to(:campaign) }
  end

  describe 'statuses' do
    it 'has the same statuses as Deploy' do
      expect(CampaignDeploy::STATUS).to eq(WebsiteDeploy::STATUS)
    end
  end

  describe 'scopes' do
    describe '.in_progress' do
      it 'returns deploys with pending status' do
        pending_deploy = create(:campaign_deploy, campaign: campaign, status: 'pending')
        expect(CampaignDeploy.in_progress).to include(pending_deploy)
      end

      it 'does not return completed deploys' do
        completed_deploy = create(:campaign_deploy, campaign: campaign, status: 'completed')
        expect(CampaignDeploy.in_progress).not_to include(completed_deploy)
      end

      it 'does not return failed deploys' do
        failed_deploy = create(:campaign_deploy, campaign: campaign, status: 'failed')
        expect(CampaignDeploy.in_progress).not_to include(failed_deploy)
      end
    end
  end

  describe '.deploy' do
    let(:mock_redis) { instance_double(Redis) }
    let(:mock_suo_client) { instance_double(Suo::Client::Redis) }
    let(:lock_token) { "lock_token_123" }

    before do
      allow(Redis).to receive(:new).and_return(mock_redis)
      allow(Suo::Client::Redis).to receive(:new).and_return(mock_suo_client)
      allow(mock_suo_client).to receive(:lock).and_return(lock_token)
      allow(mock_suo_client).to receive(:unlock).with(lock_token)
      mock_google_ads_client
    end

    context 'when no deploy is in progress' do
      before do
        # Mock the instance deploy method so we don't run actual steps
        allow_any_instance_of(CampaignDeploy).to receive(:deploy)
      end

      it 'creates a new campaign deploy' do
        expect {
          CampaignDeploy.deploy(campaign, async: false)
        }.to change { CampaignDeploy.count }.by(1)
      end

      it 'returns the created campaign deploy' do
        result = CampaignDeploy.deploy(campaign, async: false)
        expect(result).to be_a(CampaignDeploy)
        expect(result.campaign).to eq(campaign)
      end

      it 'acquires a distributed lock with the campaign id' do
        expect(Suo::Client::Redis).to receive(:new).with(
          "campaign_deploy:#{campaign.id}",
          hash_including(acquisition_lock: 0.5, stale_lock_expiration: 30.seconds.to_i)
        ).and_return(mock_suo_client)

        CampaignDeploy.deploy(campaign, async: false)
      end

      it 'releases the lock after completion' do
        expect(mock_suo_client).to receive(:unlock)
        CampaignDeploy.deploy(campaign, async: false)
      end

      context 'with async: true' do
        it 'enqueues a DeployWorker' do
          allow_any_instance_of(CampaignDeploy).to receive(:deploy).and_call_original
          expect(CampaignDeploy::DeployWorker).to receive(:perform_async)
          CampaignDeploy.deploy(campaign, async: true)
        end
      end

      context 'with async: false' do
        it 'calls the instance deploy method with async: false' do
          expect_any_instance_of(CampaignDeploy).to receive(:deploy).with(async: false, job_run_id: nil)
          CampaignDeploy.deploy(campaign, async: false)
        end
      end
    end

    context 'when a deploy is already in progress' do
      before do
        create(:campaign_deploy, campaign: campaign, status: 'pending')
      end

      it 'raises DeployInProgressError' do
        expect {
          CampaignDeploy.deploy(campaign, async: false)
        }.to raise_error(CampaignDeploy::DeployInProgressError, /already in progress/)
      end

      it 'does not create another deploy' do
        expect {
          begin
            CampaignDeploy.deploy(campaign, async: false)
          rescue
            nil
          end
        }.not_to change { CampaignDeploy.count }
      end
    end

    context 'when lock cannot be acquired' do
      before do
        allow(mock_suo_client).to receive(:lock).and_return(false)
      end

      it 'raises LockNotAcquiredError' do
        expect {
          CampaignDeploy.deploy(campaign, async: false)
        }.to raise_error(Lockable::LockNotAcquiredError)
      end
    end

    context 'when an error occurs during deploy' do
      before do
        allow_any_instance_of(CampaignDeploy).to receive(:deploy).and_raise(StandardError, 'Deploy failed')
      end

      it 'releases the lock even on error' do
        expect(mock_suo_client).to receive(:unlock)
        expect {
          CampaignDeploy.deploy(campaign, async: false)
        }.to raise_error(StandardError, 'Deploy failed')
      end
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

    it 'has :sync_budget as the first step' do
      expect(CampaignDeploy::STEPS.first.name).to eq(:sync_budget)
    end
  end

  describe '#next_step' do
    context 'when current_step is nil' do
      it 'returns the first step instance' do
        campaign_deploy.current_step = nil
        step = campaign_deploy.next_step
        expect(step).to be_a(CampaignDeploy::Step)
        expect(step.class.step_name).to eq(:sync_budget)
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
      expect(CampaignDeploy::DeployWorker).to receive(:perform_async).with(campaign_deploy.id, nil)
      campaign_deploy.deploy(async: true)
    end

    it 'calls actually_deploy when async: false' do
      allow(campaign_deploy).to receive(:actually_deploy)
      campaign_deploy.deploy(async: false)
      expect(campaign_deploy).to have_received(:actually_deploy).with(async: false, job_run_id: nil)
    end
  end

  describe '#actually_deploy' do
    let(:mock_redis) { instance_double(Redis) }
    let(:mock_suo_client) { instance_double(Suo::Client::Redis) }
    let(:lock_token) { "lock_token_123" }

    before do
      mock_google_ads_client
      allow(Redis).to receive(:new).and_return(mock_redis)
      allow(Suo::Client::Redis).to receive(:new).and_return(mock_suo_client)
      allow(mock_suo_client).to receive(:lock).and_return(lock_token)
      allow(mock_suo_client).to receive(:unlock).with(lock_token)
    end

    context 'locking behavior' do
      it 'acquires a distributed lock before executing steps' do
        allow(campaign_deploy).to receive(:next_step).and_return(nil)

        expect(Suo::Client::Redis).to receive(:new).with(
          "campaign_deploy:#{campaign.id}",
          hash_including(acquisition_lock: 5, stale_lock_expiration: 10.minutes.to_i)
        ).and_return(mock_suo_client)

        campaign_deploy.actually_deploy(async: false)
      end

      it 'releases the lock after step execution' do
        allow(campaign_deploy).to receive(:next_step).and_return(nil)
        expect(mock_suo_client).to receive(:unlock).with(lock_token)
        campaign_deploy.actually_deploy(async: false)
      end

      it 'releases the lock even if step raises an error' do
        allow(campaign_deploy).to receive(:next_step).and_raise(StandardError, 'Step failed')

        expect(mock_suo_client).to receive(:unlock).with(lock_token)
        expect {
          campaign_deploy.actually_deploy(async: false)
        }.to raise_error(StandardError, 'Step failed')
      end

      it 'raises LockNotAcquiredError when lock cannot be acquired' do
        allow(mock_suo_client).to receive(:lock).and_return(false)

        expect {
          campaign_deploy.actually_deploy(async: false)
        }.to raise_error(Lockable::LockNotAcquiredError)
      end
      it 'enqueues next step outside the lock (async mode)' do
        mock_step = double("Step")
        allow(campaign_deploy).to receive(:next_step).and_return(mock_step, nil)
        allow(mock_step).to receive(:finished?).and_return(true)
        allow(mock_step).to receive(:run)
        allow(mock_step).to receive(:class).and_return(double(step_name: :test_step))

        # Lock should be released before enqueue
        unlock_called = false
        allow(mock_suo_client).to receive(:unlock) { unlock_called = true }

        expect(CampaignDeploy::DeployWorker).to receive(:perform_async) do
          expect(unlock_called).to be true
        end

        campaign_deploy.actually_deploy(async: true)
      end
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

      it 'does not advance current_step so retry re-runs the same step' do
        previous_step = campaign_deploy.current_step
        begin
          campaign_deploy.actually_deploy(async: false)
        rescue CampaignDeploy::StepNotFinishedError
          # expected
        end
        expect(campaign_deploy.reload.current_step).to eq(previous_step)
      end

      it 'includes diagnostic in the error message' do
        sync_result = double("SyncResult", to_h: { entity: :ad_group_ad, status: :error, error: "GoogleAdsError: policy_finding: PROHIBITED" })
        allow(mock_step).to receive(:respond_to?).with(:sync_result).and_return(true)
        allow(mock_step).to receive(:sync_result).and_return(sync_result)

        expect {
          campaign_deploy.actually_deploy(async: false)
        }.to raise_error(CampaignDeploy::StepNotFinishedError, /Diagnostic:.*PROHIBITED/)
      end

      it 'includes run result errors when step.run returns SyncResult errors' do
        error_result = double("ErrorResult",
          error?: true,
          to_h: { resource_type: :ad_group_ad, action: :error, error: "policy_finding_error: POLICY_FINDING" })
        allow(mock_step).to receive(:run).and_return([error_result])

        expect {
          campaign_deploy.actually_deploy(async: false)
        }.to raise_error(CampaignDeploy::StepNotFinishedError, /Run errors:.*POLICY_FINDING/)
      end

      it 'raises TerminalStepError for terminal GoogleAdsError in run result' do
        google_error = mock_google_ads_error(
          message: "A policy was violated",
          error_type: :policy_finding_error,
          error_value: :POLICY_FINDING
        )
        error_result = GoogleAds::SyncResult.error(:ad_group_ad, google_error)
        allow(mock_step).to receive(:run).and_return([error_result])

        expect {
          campaign_deploy.actually_deploy(async: false)
        }.to raise_error(CampaignDeploy::TerminalStepError, /Terminal error in test_step.*policy was violated/)
      end

      it 'logs the failure to the google_ads logger' do
        log_output = StringIO.new
        test_logger = ActiveSupport::TaggedLogging.new(Logger.new(log_output))
        allow(GoogleAds::Instrumentation).to receive(:google_ads_logger).and_return(test_logger)

        begin
          campaign_deploy.actually_deploy(async: false)
        rescue CampaignDeploy::StepNotFinishedError
          # expected
        end

        expect(log_output.string).to include("[CampaignDeploy]")
        expect(log_output.string).to include("test_step")
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
        expect(CampaignDeploy::DeployWorker).to receive(:perform_async).with(campaign_deploy.id, nil)
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
      it 'returns a step instance for :sync_budget' do
        step = runner.find(:sync_budget)
        expect(step).to be_a(CampaignDeploy::Step)
        expect(step.class.step_name).to eq(:sync_budget)
      end

      it 'returns a step instance for :create_geo_targeting' do
        step = runner.find(:create_geo_targeting)
        expect(step).to be_a(CampaignDeploy::Step)
        expect(step.class.step_name).to eq(:create_geo_targeting)
      end
    end
    describe ':create_geo_targeting step' do
      let(:step) { runner.find(:create_geo_targeting) }
      let!(:location_target) do
        create(:ad_location_target, campaign: campaign,
          location_name: "Los Angeles",
          country_code: "US",
          location_type: "City",
          platform_settings: { "google" => { "geo_target_constant" => "geoTargetConstants/1013962" } })
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
            "google" => { "criterion_id" => "111" }
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
            location_name: "San Francisco",
            country_code: "US",
            location_type: "City",
            platform_settings: {
              "google" => {
                "geo_target_constant" => "geoTargetConstants/1014221",
                "criterion_id" => "222"
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
              location_id: 1014221,
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

        it 'clears the criterion_id after deletion' do
          step.run
          deleted_target.reload
          expect(deleted_target.google_criterion_id).to be_nil
        end
      end

      context 'when deleted target does not exist in Google' do
        let!(:deleted_target) do
          target = create(:ad_location_target, campaign: campaign,
            location_name: "San Diego",
            country_code: "US",
            location_type: "City",
            platform_settings: {
              "google" => {
                "geo_target_constant" => "geoTargetConstants/1014218",
                "criterion_id" => "222"
              }
            })
          target.destroy
          target
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
          mock_remove_resource = double("RemoveResource")
          allow(mock_remove_resource).to receive(:campaign_criterion).and_return("remove_operation")
          allow(@mock_operation).to receive(:remove_resource).and_return(mock_remove_resource)
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
                "geo_target_constant" => "geoTargetConstants/1023191",
                "criterion_id" => "333"
              }
            })
        end

        let!(:new_target) do
          create(:ad_location_target, campaign: campaign,
            location_name: "Chicago",
            country_code: "US",
            location_type: "City",
            platform_settings: { "google" => { "geo_target_constant" => "geoTargetConstants/1014895" } })
        end

        let!(:deleted_target) do
          target = create(:ad_location_target, campaign: campaign,
            location_name: "Boston",
            country_code: "US",
            location_type: "City",
            platform_settings: {
              "google" => {
                "geo_target_constant" => "geoTargetConstants/1018127",
                "criterion_id" => "444"
              }
            })
          target.destroy
          target
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_campaign_criterion(criterion_id: 444, campaign_id: 789, customer_id: 456, location_id: 1018127, negative: false),
            mock_search_response_with_campaign_criterion(criterion_id: 333, campaign_id: 789, customer_id: 456, location_id: 1023191, negative: false),
            mock_search_response_with_campaign_criterion(criterion_id: 555, campaign_id: 789, customer_id: 456, location_id: 1014895, negative: false)
          )
          mock_remove_resource = double("RemoveResource")
          allow(mock_remove_resource).to receive(:campaign_criterion).and_return("remove_operation")
          allow(@mock_operation).to receive(:remove_resource).and_return(mock_remove_resource)
          allow(@mock_update_resource).to receive(:campaign_criterion).and_yield(mock_campaign_criterion_resource).and_return(mock_campaign_criterion_resource)
          allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(
            mock_mutate_campaign_criterion_response(criterion_id: 555, campaign_id: 789, customer_id: 456)
          )
        end

        it 'deletes removed targets and creates new ones' do
          expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).at_least(:twice)
          step.run
        end

        it 'clears criterion_id on deleted target' do
          step.run
          expect(deleted_target.reload.google_criterion_id).to be_nil
        end

        it 'sets criterion_id on new target' do
          step.run
          expect(new_target.reload.google_criterion_id).to eq("555")
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
            mock_search_response_with_budget(
              budget_id: 123,
              name: budget.google_budget_name,
              amount_micros: budget.daily_budget_cents * 10_000
            )
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
            mock_search_response_with_campaign(
              campaign_id: 789,
              customer_id: 456,
              name: campaign.name,
              status: :PAUSED,
              advertising_channel_type: :SEARCH
            )
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

    describe ':create_callouts step' do
      let(:step) { runner.find(:create_callouts) }
      let!(:ads_account) { account.create_ads_account!(platform: "google", google_customer_id: "456") }
      let!(:ad_group) { create(:ad_group, campaign: campaign) }

      before do
        campaign.update!(ads_account: ads_account, platform_settings: { "google" => { "campaign_id" => "789" } })
        allow(@mock_resource).to receive(:asset).and_yield(mock_asset_with_callout_resource).and_return(mock_asset_with_callout_resource)
        allow(@mock_resource).to receive(:callout_asset).and_yield(mock_callout_asset_resource).and_return(mock_callout_asset_resource)
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

      context 'when callouts are already synced' do
        let!(:callout) do
          create(:ad_callout, campaign: campaign, ad_group: ad_group, text: "Free Shipping",
            platform_settings: { "google" => { "asset_id" => "88888", "campaign_asset_id" => "789~88888" } })
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_callout_asset(asset_id: 88888, customer_id: 456, callout_text: "Free Shipping")
          )
        end

        it 'reports finished' do
          expect(step.finished?).to be true
        end
      end
    end

    describe ':create_structured_snippets step' do
      let(:step) { runner.find(:create_structured_snippets) }
      let!(:ads_account) { account.create_ads_account!(platform: "google", google_customer_id: "456") }

      before do
        campaign.update!(ads_account: ads_account, platform_settings: { "google" => { "campaign_id" => "789" } })
        allow(@mock_resource).to receive(:asset).and_yield(mock_asset_with_structured_snippet_resource).and_return(mock_asset_with_structured_snippet_resource)
        allow(@mock_resource).to receive(:structured_snippet_asset).and_yield(mock_structured_snippet_asset_resource).and_return(mock_structured_snippet_asset_resource)
        allow(@mock_resource).to receive(:campaign_asset).and_yield(mock_campaign_asset_resource).and_return(mock_campaign_asset_resource)
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", asset: mock_asset_with_structured_snippet_resource, campaign_asset: mock_campaign_asset_resource)
        )
      end

      context 'when structured snippets need syncing' do
        let!(:snippet) { create(:ad_structured_snippet, campaign: campaign, category: "brands", values: ["Nike", "Adidas", "Puma"]) }

        before do
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

        it 'reports not finished before sync' do
          expect(step.finished?).to be false
        end
      end

      context 'when structured snippets are already synced' do
        let!(:snippet) do
          create(:ad_structured_snippet, campaign: campaign, category: "brands", values: ["Nike", "Adidas", "Puma"],
            platform_settings: { "google" => { "asset_id" => "99999", "campaign_asset_id" => "789~99999" } })
        end

        before do
          allow(@mock_google_ads_service).to receive(:search).and_return(
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
            mock_search_response_with_ad_group(ad_group_id: 999, customer_id: 456, name: "Test Ad Group", status: :PAUSED)
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
            mock_search_response_with_keyword(criterion_id: 444, ad_group_id: 999, customer_id: 456, keyword_text: "deleted keyword", match_type: :PHRASE),
            mock_search_response_with_keyword(criterion_id: 333, ad_group_id: 999, customer_id: 456, keyword_text: "existing keyword", match_type: :BROAD),
            mock_search_response_with_keyword(criterion_id: 555, ad_group_id: 999, customer_id: 456, keyword_text: "new keyword", match_type: :EXACT)
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
          # NOTE: Keyword stores criterion_id as integer, unlike LocationTarget which stores as string
          expect(new_keyword.reload.google_criterion_id).to eq(555)
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

    describe '#plan' do
      let!(:ads_account) { account.create_ads_account!(platform: "google", google_customer_id: "456") }

      before do
        # Default: allow all Google Ads searches to return empty (nothing synced)
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it 'returns a GoogleAds::Sync::Plan object' do
        plan = runner.plan
        expect(plan).to be_a(GoogleAds::Sync::Plan)
      end

      it 'includes all operations across all steps' do
        plan = runner.plan
        expect(plan).to respond_to(:operations)
        expect(plan.operations).to be_an(Array)
      end

      context 'with a fresh campaign (nothing synced)' do
        let!(:budget) { create(:ad_budget, campaign: campaign, daily_budget_cents: 500) }
        let!(:ad_group) { create(:ad_group, campaign: campaign, name: "Test Ad Group") }
        let!(:ad) { create(:ad, ad_group: ad_group, status: "draft") }
        let!(:keyword) { create(:ad_keyword, ad_group: ad_group, text: "test keyword", match_type: "broad") }
        let!(:location_target) do
          create(:ad_location_target, campaign: campaign,
            location_name: "Los Angeles",
            country_code: "US",
            location_type: "City",
            platform_settings: { "google" => { "geo_target_constant" => "geoTargetConstants/1013962" } })
        end

        it 'returns operations for all resources that need creation' do
          plan = runner.plan

          expect(plan.creates).not_to be_empty
          expect(plan.any_changes?).to be true
        end

        it 'includes budget creation' do
          plan = runner.plan
          budget_ops = plan.creates.select { |op| op[:record].is_a?(AdBudget) }
          expect(budget_ops.size).to eq(1)
        end

        it 'includes campaign creation' do
          plan = runner.plan
          campaign_ops = plan.creates.select { |op| op[:record].is_a?(Campaign) }
          expect(campaign_ops.size).to eq(1)
        end

        it 'includes ad_group creation' do
          plan = runner.plan
          ad_group_ops = plan.creates.select { |op| op[:record].is_a?(AdGroup) }
          expect(ad_group_ops.size).to eq(1)
        end

        it 'includes keyword creation' do
          plan = runner.plan
          keyword_ops = plan.creates.select { |op| op[:record].is_a?(AdKeyword) }
          expect(keyword_ops.size).to eq(1)
        end

        it 'includes ad creation' do
          plan = runner.plan
          ad_ops = plan.creates.select { |op| op[:record].is_a?(Ad) }
          expect(ad_ops.size).to eq(1)
        end

        it 'includes location target creation' do
          plan = runner.plan
          location_ops = plan.creates.select { |op| op[:record].is_a?(AdLocationTarget) }
          expect(location_ops.size).to eq(1)
        end
      end

      context 'with a fully synced campaign' do
        let!(:budget) do
          create(:ad_budget, campaign: campaign,
            daily_budget_cents: 500,
            platform_settings: { "google" => { "budget_id" => "123" } })
        end
        let!(:ad_group) do
          create(:ad_group, campaign: campaign, name: "Test Ad Group",
            platform_settings: { "google" => { "ad_group_id" => "999" } })
        end
        let!(:ad) do
          create(:ad, ad_group: ad_group, status: "active",
            platform_settings: { "google" => { "ad_id" => "12345" } })
        end
        let!(:keyword) do
          create(:ad_keyword, ad_group: ad_group, text: "test keyword", match_type: "broad",
            platform_settings: { "google" => { "criterion_id" => "333" } })
        end
        let!(:location_target) do
          create(:ad_location_target, campaign: campaign,
            location_name: "Los Angeles",
            platform_settings: { "google" => { "geo_target_constant" => "geoTargetConstants/1013962", "criterion_id" => "111" } })
        end

        before do
          campaign.update!(platform_settings: { "google" => { "campaign_id" => "789" } })

          allow(@mock_google_ads_service).to receive(:search).and_return(
            # Budget query
            mock_search_response_with_budget(
              budget_id: 123,
              name: budget.google_budget_name,
              amount_micros: budget.daily_budget_cents * 10_000
            ),
            # Campaign query
            mock_search_response_with_campaign(
              campaign_id: 789,
              customer_id: 456,
              name: campaign.name,
              status: :PAUSED,
              advertising_channel_type: :SEARCH
            ),
            # Location target query
            mock_search_response_with_campaign_criterion(
              criterion_id: 111,
              campaign_id: 789,
              customer_id: 456,
              location_id: 1013962,
              negative: false
            ),
            # Ad group query
            mock_search_response_with_ad_group(
              ad_group_id: 999,
              customer_id: 456,
              name: "Test Ad Group",
              status: :PAUSED
            ),
            # Keyword query
            mock_search_response_with_keyword(
              criterion_id: 333,
              ad_group_id: 999,
              customer_id: 456,
              keyword_text: "test keyword"
            ),
            # Ad query
            mock_search_response_with_ad_group_ad(
              ad_id: 12345,
              ad_group_id: 999,
              customer_id: 456,
              status: :ENABLED
            )
          )
        end

        it 'returns no changes when everything is synced' do
          plan = runner.plan

          expect(plan.creates).to be_empty
          expect(plan.updates).to be_empty
          expect(plan.deletes).to be_empty
          expect(plan.any_changes?).to be false
        end

        it 'returns unchanged operations for synced resources' do
          plan = runner.plan

          expect(plan.unchanged).not_to be_empty
        end

        it "does add changes once things are unsynced again" do
          campaign.update!(name: "New Name")
          campaign.budget.update!(daily_budget_cents: 1000)
          campaign.ad_groups.first.update!(name: "New Ad Group Name")
          campaign.keywords.first.update!(text: "New Keyword")
          campaign.ads.first.update!(status: "paused")
          campaign.location_targets.first.update!(targeted: false)
          plan = runner.plan

          campaign_plan = plan.campaigns
          expect(campaign_plan.updates.first[:fields]).to eq([:name])

          budget_plan = plan.budgets
          expect(budget_plan.updates.first[:fields]).to eq([:amount_micros])

          ad_group_plan = plan.ad_groups
          expect(ad_group_plan.updates.first[:fields]).to eq([:name])

          keyword_plan = plan.keywords
          expect(keyword_plan.updates.first[:fields]).to eq([:text])

          location_plan = plan.location_targets
          expect(location_plan.updates.first[:fields]).to eq([:negative])
        end
      end

      context 'with mixed operations (create, update, delete)' do
        let!(:budget) do
          create(:ad_budget, campaign: campaign,
            daily_budget_cents: 500,
            platform_settings: { "google" => { "budget_id" => "123" } })
        end
        let!(:ad_group) do
          create(:ad_group, campaign: campaign, name: "Test Ad Group",
            platform_settings: { "google" => { "ad_group_id" => "999" } })
        end
        # New keyword (needs create)
        let!(:new_keyword) do
          create(:ad_keyword, ad_group: ad_group, text: "new keyword", match_type: "exact")
        end
        # Existing keyword (unchanged)
        let!(:existing_keyword) do
          create(:ad_keyword, ad_group: ad_group, text: "existing keyword", match_type: "broad",
            platform_settings: { "google" => { "criterion_id" => "333" } })
        end
        # Deleted keyword (needs delete)
        let!(:deleted_keyword) do
          keyword = create(:ad_keyword, ad_group: ad_group, text: "deleted keyword", match_type: "phrase",
            platform_settings: { "google" => { "criterion_id" => "444" } })
          keyword.destroy
          keyword
        end

        before do
          campaign.update!(platform_settings: { "google" => { "campaign_id" => "789" } })

          # Mock order must match actual API call order:
          # 1. Budget fetch_by_id
          # 2. Campaign fetch
          # 3. AdGroup fetch
          # 4. existing_keyword fetch (deleted keywords don't trigger fetch - just add delete op)
          # Note: new_keyword has no criterion_id, so no fetch call
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_search_response_with_budget(
              budget_id: 123,
              name: budget.google_budget_name,
              amount_micros: budget.daily_budget_cents * 10_000
            ),
            mock_search_response_with_campaign(
              campaign_id: 789,
              customer_id: 456,
              name: campaign.name,
              status: :PAUSED,
              advertising_channel_type: :SEARCH
            ),
            mock_search_response_with_ad_group(
              ad_group_id: 999,
              customer_id: 456,
              name: "Test Ad Group",
              status: :PAUSED
            ),
            # Existing keyword is synced
            mock_search_response_with_keyword(
              criterion_id: 333,
              ad_group_id: 999,
              customer_id: 456,
              keyword_text: "existing keyword",
              match_type: :BROAD
            )
          )
        end

        it 'includes creates for new resources' do
          plan = runner.plan
          creates = plan.creates.select { |op| op[:record].is_a?(AdKeyword) }
          expect(creates.size).to be >= 1
        end

        it 'includes deletes for soft-deleted resources' do
          plan = runner.plan
          deletes = plan.deletes.select { |op| op[:record].is_a?(AdKeyword) }
          expect(deletes.size).to be >= 1
        end

        it 'includes unchanged for synced resources' do
          plan = runner.plan
          unchanged_keywords = plan.unchanged.select { |op| op[:record].is_a?(AdKeyword) }
          expect(unchanged_keywords.size).to be >= 1
        end
      end

      context 'with ad schedule updates' do
        let!(:schedule) do
          create(:ad_schedule, campaign: campaign,
            day_of_week: "Monday", start_hour: 9, end_hour: 17,
            platform_settings: { "google" => { "criterion_id" => "222" } })
        end

        before do
          campaign.update!(platform_settings: { "google" => { "campaign_id" => "789" } })

          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_empty_search_response, # budget
            mock_search_response_with_campaign(
              campaign_id: 789,
              customer_id: 456,
              name: campaign.name,
              status: :PAUSED,
              advertising_channel_type: :SEARCH
            ),
            mock_search_response_with_ad_schedule(
              criterion_id: 222,
              campaign_id: 789,
              customer_id: 456,
              day_of_week: :MONDAY
            )
          )
        end

        it 'includes ad schedule operations' do
          plan = runner.plan
          schedule_ops = plan.operations.select { |op| op[:record].is_a?(AdSchedule) }
          expect(schedule_ops).not_to be_empty
        end
      end

      context 'with structured snippet recreate' do
        let!(:snippet) do
          create(:ad_structured_snippet, campaign: campaign,
            category: "brands",
            values: ["Nike", "Adidas", "Puma"],
            platform_settings: { "google" => { "asset_id" => "99999" } })
        end

        before do
          campaign.update!(platform_settings: { "google" => { "campaign_id" => "789" } })

          # Simulate that the snippet values have changed (requires recreate)
          allow(@mock_google_ads_service).to receive(:search).and_return(
            mock_empty_search_response, # budget
            mock_search_response_with_campaign(
              campaign_id: 789,
              customer_id: 456,
              name: campaign.name,
              status: :PAUSED,
              advertising_channel_type: :SEARCH
            ),
            mock_search_response_with_structured_snippet_asset(
              asset_id: 99999,
              customer_id: 456,
              header: "Brands",
              values: ["Nike", "Puma"] # Different values - will trigger recreate
            )
          )
        end

        it 'includes recreate operations for immutable field changes' do
          plan = runner.plan
          recreates = plan.operations.select { |op| op[:action] == :recreate }
          expect(recreates.size).to be >= 1
        end
      end

      context 'as dry run' do
        let!(:budget) { create(:ad_budget, campaign: campaign, daily_budget_cents: 500) }

        # Note: PlatformSettings concern auto-saves defaults when accessed.
        # This is acceptable for a dry run - the key requirement is no Google Ads API mutations.

        it 'does not call any mutate APIs' do
          expect(@mock_campaign_budget_service).not_to receive(:mutate_campaign_budgets)
          expect(@mock_campaign_service).not_to receive(:mutate_campaigns)
          expect(@mock_ad_group_service).not_to receive(:mutate_ad_groups)
          expect(@mock_ad_group_ad_service).not_to receive(:mutate_ad_group_ads)
          expect(@mock_ad_group_criterion_service).not_to receive(:mutate_ad_group_criteria)
          expect(@mock_campaign_criterion_service).not_to receive(:mutate_campaign_criteria)

          runner.plan
        end
      end

      context 'serialization' do
        let!(:budget) { create(:ad_budget, campaign: campaign, daily_budget_cents: 500) }
        let!(:ad_group) { create(:ad_group, campaign: campaign, name: "Test Ad Group") }

        it 'can be serialized to a hash' do
          plan = runner.plan
          hash = plan.to_h

          expect(hash).to include(:creates, :updates, :deletes, :unchanged, :any_changes, :operations)
          expect(hash[:creates]).to be_a(Integer)
          expect(hash[:any_changes]).to be true
        end

        it 'provides operation counts' do
          plan = runner.plan
          hash = plan.to_h

          expect(hash[:creates]).to be > 0
          expect(hash[:operations].size).to be > 0
        end
      end
    end

    describe 'step-level plans' do
      let!(:ads_account) { account.create_ads_account!(platform: "google", google_customer_id: "456") }
      let!(:budget) { create(:ad_budget, campaign: campaign, daily_budget_cents: 500) }
      let!(:ad_group) { create(:ad_group, campaign: campaign, name: "Test Ad Group") }
      let!(:keyword) { create(:ad_keyword, ad_group: ad_group, text: "test keyword", match_type: "broad") }

      before do
        campaign.update!(platform_settings: { "google" => { "campaign_id" => "789" } })
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it 'each step can report its own plan via sync_plan' do
        step = runner.find(:sync_budget)
        expect(step).to respond_to(:sync_plan)

        step_plan = step.sync_plan
        expect(step_plan).to be_a(GoogleAds::Sync::Plan)
      end

      it 'step plans only include operations for that step' do
        budget_step = runner.find(:sync_budget)
        budget_plan = budget_step.sync_plan

        budget_ops = budget_plan.operations.select { |op| op[:record].is_a?(AdBudget) }
        expect(budget_ops.size).to eq(budget_plan.operations.size)
      end

      it 'keywords step plan only includes keyword operations' do
        campaign.ad_groups.first.update!(platform_settings: { "google" => { "ad_group_id" => "999" } })

        keywords_step = runner.find(:create_keywords)
        keywords_plan = keywords_step.sync_plan

        keyword_ops = keywords_plan.operations.select { |op| op[:record].is_a?(AdKeyword) }
        expect(keyword_ops.size).to eq(keywords_plan.operations.size)
      end
    end
  end
end
