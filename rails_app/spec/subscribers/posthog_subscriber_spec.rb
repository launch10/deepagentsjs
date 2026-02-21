# frozen_string_literal: true

require "rails_helper"

RSpec.describe PosthogSubscriber do
  # The subscriber is already registered via config/initializers/app_events.rb.
  # These tests exercise the existing subscription — no need to re-subscribe.

  let(:user) { create(:user) }
  let(:account) { user.owned_account }
  let(:project) { create(:project, account: account) }

  describe ".subscribe!" do
    it "creates an AppEvent when an event is published" do
      expect {
        ActiveSupport::Notifications.instrument("app_event.test_action", user: user, account: account, foo: "bar")
      }.to change(AppEvent, :count).by(1)

      event = AppEvent.last
      expect(event.event_name).to eq("test_action")
      expect(event.user).to eq(user)
      expect(event.account).to eq(account)
      expect(event.properties).to include("foo" => "bar")
    end

    it "creates an AppEvent with project, campaign, and website" do
      website = create(:website, project: project)
      campaign = create(:campaign, project: project)

      ActiveSupport::Notifications.instrument(
        "app_event.deploy_completed",
        user: user,
        account: account,
        project: project,
        campaign: campaign,
        website: website
      )

      event = AppEvent.last
      expect(event.event_name).to eq("deploy_completed")
      expect(event.project).to eq(project)
      expect(event.campaign).to eq(campaign)
      expect(event.website).to eq(website)
    end

    it "calls PosthogTracker.capture when user is present" do
      allow(PosthogTracker).to receive(:capture)

      ActiveSupport::Notifications.instrument("app_event.page_view", user: user, account: account)

      expect(PosthogTracker).to have_received(:capture).with(user, "page_view", hash_including).at_least(:once)
    end

    it "skips PostHog but still writes AppEvent when user is nil" do
      allow(PosthogTracker).to receive(:capture)

      expect {
        ActiveSupport::Notifications.instrument("app_event.anonymous_action", account: account)
      }.to change(AppEvent, :count).by_at_least(1)

      expect(PosthogTracker).not_to have_received(:capture)
    end

    it "rescues and logs write_app_event failures without raising" do
      allow(AppEvent).to receive(:create!).and_raise(ActiveRecord::RecordInvalid.new(AppEvent.new))
      allow(Rails.logger).to receive(:error)

      expect {
        ActiveSupport::Notifications.instrument("app_event.broken_event", user: user, account: account)
      }.not_to raise_error

      expect(Rails.logger).to have_received(:error).with(/PosthogSubscriber\.write_app_event failed/).at_least(:once)
    end

    it "resolves account from project when account not provided" do
      ActiveSupport::Notifications.instrument("app_event.project_event", user: user, project: project)

      event = AppEvent.last
      expect(event.account).to eq(account)
    end

    it "resolves account from user when neither account nor project provided" do
      ActiveSupport::Notifications.instrument("app_event.user_event", user: user)

      event = AppEvent.last
      expect(event.account).to eq(user.accounts.first)
    end
  end
end
