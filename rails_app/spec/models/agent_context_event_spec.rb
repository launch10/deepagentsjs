# == Schema Information
#
# Table name: agent_context_events
#
#  id             :bigint           not null, primary key
#  event_type     :string           not null
#  eventable_type :string
#  payload        :jsonb
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  account_id     :bigint           not null
#  eventable_id   :bigint
#  project_id     :bigint
#  user_id        :bigint
#
# Indexes
#
#  index_agent_context_events_on_account_id                       (account_id)
#  index_agent_context_events_on_created_at                       (created_at)
#  index_agent_context_events_on_event_type                       (event_type)
#  index_agent_context_events_on_eventable_type_and_eventable_id  (eventable_type,eventable_id)
#  index_agent_context_events_on_project_id_and_created_at        (project_id,created_at)
#
require "rails_helper"

RSpec.describe AgentContextEvent, type: :model do
  let(:user) { create(:user) }
  let(:account) { user.owned_account }
  let(:project) { create(:project, account: account) }

  describe "associations" do
    it { is_expected.to belong_to(:account) }
    it { is_expected.to belong_to(:project).optional }
    it { is_expected.to belong_to(:user).optional }
    it { is_expected.to belong_to(:eventable).optional }
  end

  describe "validations" do
    it "validates event_type presence" do
      event = AgentContextEvent.new(account: account, event_type: nil)
      expect(event).not_to be_valid
      expect(event.errors[:event_type]).to include("can't be blank")
    end

    it "validates event_type format (resource.verb)" do
      event = AgentContextEvent.new(account: account, event_type: "invalid")
      expect(event).not_to be_valid
      expect(event.errors[:event_type]).to be_present
    end

    it "accepts valid event_type format" do
      event = AgentContextEvent.new(
        account: account,
        event_type: "images.created"
      )
      expect(event).to be_valid
    end

    it "accepts images.deleted event_type" do
      event = AgentContextEvent.new(
        account: account,
        event_type: "images.deleted"
      )
      expect(event).to be_valid
    end
  end

  describe "scopes" do
    let!(:old_event) do
      create(:agent_context_event,
        account: account,
        project: project,
        event_type: "images.created",
        created_at: 2.hours.ago)
    end
    let!(:new_event) do
      create(:agent_context_event,
        account: account,
        project: project,
        event_type: "images.deleted",
        created_at: 1.minute.ago)
    end
    let!(:other_project_event) do
      other_project = create(:project, account: account)
      create(:agent_context_event,
        account: account,
        project: other_project,
        event_type: "images.created")
    end

    describe ".since" do
      it "filters events after the given timestamp" do
        events = AgentContextEvent.since(1.hour.ago)
        expect(events).to include(new_event, other_project_event)
        expect(events).not_to include(old_event)
      end

      it "returns all events when timestamp is nil" do
        events = AgentContextEvent.since(nil)
        expect(events).to include(old_event, new_event, other_project_event)
      end
    end

    describe ".for_project" do
      it "filters events by project" do
        events = AgentContextEvent.for_project(project.id)
        expect(events).to include(old_event, new_event)
        expect(events).not_to include(other_project_event)
      end
    end

    describe ".of_types" do
      it "filters events by event type" do
        events = AgentContextEvent.of_types(["images.deleted"])
        expect(events).to include(new_event)
        expect(events).not_to include(old_event, other_project_event)
      end

      it "accepts multiple event types" do
        events = AgentContextEvent.of_types(["images.created", "images.deleted"])
        expect(events).to include(old_event, new_event, other_project_event)
      end

      it "returns all events when types is nil" do
        events = AgentContextEvent.of_types(nil)
        expect(events).to include(old_event, new_event, other_project_event)
      end
    end

    describe ".chronological" do
      it "orders events by created_at ascending" do
        events = AgentContextEvent.chronological
        expect(events.to_a.index(old_event)).to be < events.to_a.index(new_event)
      end
    end
  end

  describe "multi-tenancy" do
    it "scopes events to the current tenant" do
      other_account = create(:account)
      ActsAsTenant.with_tenant(account) do
        create(:agent_context_event, account: account, event_type: "images.created")
      end
      ActsAsTenant.with_tenant(other_account) do
        create(:agent_context_event, account: other_account, event_type: "images.created")
      end

      ActsAsTenant.with_tenant(account) do
        expect(AgentContextEvent.count).to eq(1)
      end
    end
  end
end
