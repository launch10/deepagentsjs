# == Schema Information
#
# Table name: projects
#
#  id         :bigint           not null, primary key
#  deleted_at :datetime
#  name       :string           not null
#  uuid       :uuid             not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint           not null
#
# Indexes
#
#  index_projects_on_account_id                 (account_id)
#  index_projects_on_account_id_and_created_at  (account_id,created_at)
#  index_projects_on_account_id_and_name        (account_id,name) UNIQUE
#  index_projects_on_account_id_and_updated_at  (account_id,updated_at)
#  index_projects_on_created_at                 (created_at)
#  index_projects_on_deleted_at                 (deleted_at)
#  index_projects_on_name                       (name)
#  index_projects_on_updated_at                 (updated_at)
#  index_projects_on_uuid                       (uuid) UNIQUE
#
require "rails_helper"
RSpec.describe Project, type: :model do
  let!(:account) { create(:account) }
  let!(:template) { create(:template) }
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
