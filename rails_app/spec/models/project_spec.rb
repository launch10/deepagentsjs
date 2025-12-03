require "rails_helper"
RSpec.describe Project, type: :model do
  let!(:account) { create(:account) }
  let!(:project) do
    data = Brainstorm.create_brainstorm!(account, name: "Project", thread_id: "thread_id")
    data[:project]
  end
  let!(:website) { project.website }
  let!(:campaign) do
    result = Campaign.create_campaign!(account, {
      name: "Test Campaign",
      project_id: project.id,
      website_id: website.id
    })
    result[:campaign]
  end
  let(:workflow) do
    project.current_workflow
  end
  describe "#current_chat" do
    it "find the right chat for the current workflow" do
      project.current_workflow.advance_to(step: :brainstorm)

      expect(project.current_workflow.step).to eq "brainstorm"
      expect(project.current_chat.chat_type).to eq "brainstorm"

      workflow.next_step!

      # TODO: Update this once we build the website_building phase! This should break!
      expect(project.current_chat).to be_nil

      workflow.next_step!
      expect(project.current_workflow.step).to eq "ad_campaign"
      expect(project.current_chat.chat_type).to eq "ad_campaign"
    end
  end
end
