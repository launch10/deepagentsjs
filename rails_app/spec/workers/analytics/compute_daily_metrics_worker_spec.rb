# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::ComputeDailyMetricsWorker do
  # Freeze to 12:01am EST to test timezone handling
  # At this time: EST thinks it's Jan 29, UTC thinks it's Jan 29 (5:01am UTC)
  around do |example|
    Timecop.freeze(Time.new(2026, 1, 29, 0, 1, 0, "-05:00")) do
      example.run
    end
  end

  let(:target_date) { Date.yesterday }

  describe ".projects_with_live_deploys" do
    let(:subscribed_account) { create(:account) }
    let(:subscribed_project) { create(:project, account: subscribed_account) }
    let!(:live_deploy) { create(:deploy, :live, project: subscribed_project) }

    before do
      ensure_plans_exist
      subscribe_account(subscribed_account, plan_name: "growth_monthly")
    end

    it "returns projects with live deploys and active subscriptions" do
      expect(described_class.projects_with_live_deploys).to include(subscribed_project)
    end

    it "excludes projects without subscriptions" do
      unsubscribed_account = create(:account)
      unsubscribed_project = create(:project, account: unsubscribed_account)
      create(:deploy, :live, project: unsubscribed_project)

      expect(described_class.projects_with_live_deploys).not_to include(unsubscribed_project)
    end

    it "excludes projects without live deploys" do
      live_deploy.update!(is_live: false)
      expect(described_class.projects_with_live_deploys).not_to include(subscribed_project)
    end

    it "excludes projects with canceled subscriptions" do
      unsubscribe_account(subscribed_account)
      expect(described_class.projects_with_live_deploys).not_to include(subscribed_project)
    end
  end

  describe "#perform" do
    context "with eligible projects" do
      let(:account) { create(:account) }
      let(:project) { create(:project, account: account) }
      let!(:deploy) { create(:deploy, :live, project: project) }

      before do
        ensure_plans_exist
        subscribe_account(account, plan_name: "growth_monthly")
      end

      it "enqueues a job for projects with live deploys and active subscriptions" do
        expect(Analytics::ComputeMetricsForProjectWorker).to receive(:perform_async)
          .with(project.id, target_date.iso8601)

        subject.perform(target_date.iso8601)
      end
    end

    context "filtering" do
      let(:subscribed_account) { create(:account) }
      let(:subscribed_project) { create(:project, account: subscribed_account) }
      let!(:live_deploy) { create(:deploy, :live, project: subscribed_project) }

      let(:unsubscribed_account) { create(:account) }
      let(:unsubscribed_project) { create(:project, account: unsubscribed_account) }
      let!(:unsubscribed_live_deploy) { create(:deploy, :live, project: unsubscribed_project) }

      before do
        ensure_plans_exist
        subscribe_account(subscribed_account, plan_name: "growth_monthly")
        # unsubscribed_account is intentionally not subscribed
      end

      it "only processes projects with active subscriptions" do
        expect(Analytics::ComputeMetricsForProjectWorker).to receive(:perform_async)
          .with(subscribed_project.id, target_date.iso8601)
        expect(Analytics::ComputeMetricsForProjectWorker).not_to receive(:perform_async)
          .with(unsubscribed_project.id, target_date.iso8601)

        subject.perform(target_date.iso8601)
      end

      context "with non-live deploy" do
        before { live_deploy.update!(is_live: false) }

        it "skips projects without live deploys" do
          expect(Analytics::ComputeMetricsForProjectWorker).not_to receive(:perform_async)
          subject.perform(target_date.iso8601)
        end
      end

      context "with canceled subscription" do
        before { unsubscribe_account(subscribed_account) }

        it "skips projects with canceled subscriptions" do
          expect(Analytics::ComputeMetricsForProjectWorker).not_to receive(:perform_async)
          subject.perform(target_date.iso8601)
        end
      end
    end

    context "without date argument" do
      let(:account) { create(:account) }
      let(:project) { create(:project, account: account) }
      let!(:deploy) { create(:deploy, :live, project: project) }

      before do
        ensure_plans_exist
        subscribe_account(account, plan_name: "growth_monthly")
      end

      it "defaults to yesterday" do
        expect(Analytics::ComputeMetricsForProjectWorker).to receive(:perform_async)
          .with(project.id, Date.yesterday.iso8601)

        subject.perform
      end
    end
  end
end
