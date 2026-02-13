# == Schema Information
#
# Table name: brainstorms
#
#  id            :bigint           not null, primary key
#  audience      :string
#  completed_at  :datetime
#  deleted_at    :datetime
#  idea          :string
#  look_and_feel :string
#  social_proof  :string
#  solution      :string
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#  website_id    :bigint
#
# Indexes
#
#  index_brainstorms_on_completed_at  (completed_at)
#  index_brainstorms_on_created_at    (created_at)
#  index_brainstorms_on_deleted_at    (deleted_at)
#  index_brainstorms_on_website_id    (website_id) UNIQUE
#
require "rails_helper"

RSpec.describe Brainstorm, type: :model do
  let!(:account) { create(:account) }
  let!(:template) { create(:template) }

  def create_brainstorm(thread_id:)
    data = Brainstorm.create_brainstorm!(account, name: "Test Brainstorm", thread_id: thread_id)
    data[:brainstorm]
  end

  def complete_brainstorm(brainstorm)
    brainstorm.update!(idea: "Test idea", audience: "Test audience", solution: "Test solution", social_proof: "Test proof")
  end

  describe "event tracking" do
    it "tracks brainstorm_started on create" do
      allow(TrackEvent).to receive(:call)
      expect(TrackEvent).to receive(:call).with("brainstorm_started",
        hash_including(project_uuid: kind_of(String), is_first_brainstorm: true)
      )
      Brainstorm.create_brainstorm!(account, name: "Test Brainstorm", thread_id: "thread_1")
    end

    it "tracks brainstorm_completed when all fields are filled" do
      allow(TrackEvent).to receive(:call)
      brainstorm = create_brainstorm(thread_id: "thread_2")

      expect(TrackEvent).to receive(:call).with("brainstorm_completed",
        hash_including(project_uuid: kind_of(String), duration_minutes: kind_of(Integer))
      )
      complete_brainstorm(brainstorm)
    end

    it "does not track brainstorm_completed when only some fields are filled" do
      allow(TrackEvent).to receive(:call)
      brainstorm = create_brainstorm(thread_id: "thread_3")

      expect(TrackEvent).not_to receive(:call).with("brainstorm_completed", anything)
      brainstorm.update!(idea: "Test idea", audience: "Test audience")
    end

    it "does not track brainstorm_completed on subsequent updates after already complete" do
      allow(TrackEvent).to receive(:call)
      brainstorm = create_brainstorm(thread_id: "thread_4")
      complete_brainstorm(brainstorm)

      expect(TrackEvent).not_to receive(:call).with("brainstorm_completed", anything)
      brainstorm.update!(idea: "Updated idea")
    end

    it "does not re-fire if a field is cleared and re-filled" do
      allow(TrackEvent).to receive(:call)
      brainstorm = create_brainstorm(thread_id: "thread_5")
      complete_brainstorm(brainstorm)

      # Clear a field then re-fill — completed_at already set, should not re-fire
      brainstorm.update!(idea: nil)
      expect(TrackEvent).not_to receive(:call).with("brainstorm_completed", anything)
      brainstorm.update!(idea: "Re-filled idea")
    end
  end

  describe "#just_completed?" do
    it "returns true only during first completion save" do
      allow(TrackEvent).to receive(:call)
      brainstorm = create_brainstorm(thread_id: "thread_6")

      complete_brainstorm(brainstorm)
      expect(brainstorm.just_completed?).to be true

      brainstorm.update!(idea: "Updated idea")
      expect(brainstorm.just_completed?).to be false
    end
  end

  describe "#completed_at" do
    it "sets completed_at on first completion" do
      allow(TrackEvent).to receive(:call)
      brainstorm = create_brainstorm(thread_id: "thread_7")
      expect(brainstorm.completed_at).to be_nil

      complete_brainstorm(brainstorm)
      expect(brainstorm.completed_at).to be_present
    end

    it "does not overwrite completed_at on subsequent updates" do
      allow(TrackEvent).to receive(:call)
      brainstorm = create_brainstorm(thread_id: "thread_8")
      complete_brainstorm(brainstorm)
      original_completed_at = brainstorm.completed_at

      brainstorm.update!(idea: "Updated idea")
      expect(brainstorm.completed_at).to eq(original_completed_at)
    end

    it "does not set completed_at when partially filled" do
      allow(TrackEvent).to receive(:call)
      brainstorm = create_brainstorm(thread_id: "thread_9")
      brainstorm.update!(idea: "Test idea", audience: "Test audience")
      expect(brainstorm.completed_at).to be_nil
    end
  end

  describe "brainstorm.finished agent context" do
    it "fires brainstorm.finished agent context on first completion" do
      allow(TrackEvent).to receive(:call)
      brainstorm = create_brainstorm(thread_id: "thread_10")

      expect {
        complete_brainstorm(brainstorm)
      }.to change(AgentContextEvent, :count).by(1)

      event = AgentContextEvent.last
      expect(event.event_type).to eq("brainstorm.finished")
      expect(event.payload).to include("idea" => "Test idea")
    end

    it "does not fire brainstorm.finished on subsequent updates" do
      allow(TrackEvent).to receive(:call)
      brainstorm = create_brainstorm(thread_id: "thread_11")
      complete_brainstorm(brainstorm)

      expect {
        brainstorm.update!(idea: "Updated idea")
      }.not_to change(AgentContextEvent, :count)
    end

    it "does not fire brainstorm.finished when partially complete" do
      allow(TrackEvent).to receive(:call)
      brainstorm = create_brainstorm(thread_id: "thread_12")

      expect {
        brainstorm.update!(idea: "Test idea", audience: "Test audience")
      }.not_to change(AgentContextEvent, :count)
    end
  end
end
