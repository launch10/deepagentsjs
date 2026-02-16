# == Schema Information
#
# Table name: project_workflows
#
#  id            :bigint           not null, primary key
#  data          :jsonb
#  deleted_at    :datetime
#  status        :string           default("active"), not null
#  step          :string           not null
#  substep       :string
#  workflow_type :string           not null
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#  project_id    :bigint           not null
#
# Indexes
#
#  idx_on_project_id_workflow_type_status_a7aa4433b7        (project_id,workflow_type,status)
#  index_project_workflows_on_created_at                    (created_at)
#  index_project_workflows_on_deleted_at                    (deleted_at)
#  index_project_workflows_on_project_id                    (project_id)
#  index_project_workflows_on_project_id_and_workflow_type  (project_id,workflow_type)
#  index_project_workflows_on_status                        (status)
#  index_project_workflows_on_step                          (step)
#  index_project_workflows_on_substep                       (substep)
#  index_project_workflows_on_workflow_type                 (workflow_type)
#
require "rails_helper"

RSpec.describe ProjectWorkflow, type: :model do
  let!(:account) { create(:account) }
  let!(:project) { create(:project, account: account) }
  let!(:workflow) { create(:project_workflow, project: project, workflow_type: "launch") }

  describe "associations" do
    it { should belong_to(:project) }
  end

  describe "validations" do
    it { should validate_inclusion_of(:status).in_array(%w[active completed archived]) }
  end

  describe "scopes" do
    describe ".active" do
      it "returns only active workflows" do
        active_workflow = workflow
        completed_workflow = create(:project_workflow, project: create(:project, account: account), status: "completed")
        archived_workflow = create(:project_workflow, project: create(:project, account: account), status: "archived")

        expect(ProjectWorkflow.active).to include(active_workflow)
        expect(ProjectWorkflow.active).not_to include(completed_workflow, archived_workflow)
      end
    end
  end

  describe "#next_step!" do
    it "advances to the next step" do
      workflow.update(step: "brainstorm", substep: nil)
      workflow.next_step!

      expect(workflow.reload.step).to eq("website")
      expect(workflow.reload.substep).to eq("build")
      workflow.next_step! # domain
      workflow.next_step! # deploy

      workflow.next_step!
      expect(workflow.reload.step).to eq("ads")
      expect(workflow.reload.substep).to eq("content")

      workflow.next_step!
      expect(workflow.reload.step).to eq("ads")
      expect(workflow.reload.substep).to eq("highlights")

      workflow.next_step!
      expect(workflow.reload.step).to eq("ads")
      expect(workflow.reload.substep).to eq("keywords")

      workflow.next_step!
      expect(workflow.reload.step).to eq("ads")
      expect(workflow.reload.substep).to eq("settings")

      workflow.next_step!
      expect(workflow.reload.step).to eq("ads")
      expect(workflow.reload.substep).to eq("launch")

      workflow.next_step!
      expect(workflow.reload.step).to eq("ads")
      expect(workflow.reload.substep).to eq("review")

      workflow.next_step!
      expect(workflow.reload.step).to eq("deploy")
      expect(workflow.reload.substep).to be_nil

      workflow.next_step!
      expect(workflow.reload).to be_completed
    end
  end

  describe "#advance_to" do
    context "when advancement is valid" do
      it "advances to a valid step without substep" do
        expected_step, _ = workflow.next_step
        result = workflow.advance_to(step: expected_step)

        expect(result).to be true
        expect(workflow.reload.step).to eq(expected_step)
        expect(workflow.substep).to eq("build")
      end

      it "advances to a valid step with substep" do
        result = workflow.advance_to(step: "ads", substep: "content")

        expect(result).to be true
        expect(workflow.reload.step).to eq("ads")
        expect(workflow.substep).to eq("content")
      end

      it "advances through multiple substeps in order" do
        workflow.advance_to(step: "ads", substep: "content")
        expect(workflow.substep).to eq("content")

        workflow.advance_to(step: "ads", substep: "highlights")
        expect(workflow.reload.substep).to eq("highlights")

        workflow.advance_to(step: "ads", substep: "keywords")
        expect(workflow.reload.substep).to eq("keywords")
      end

      it "defaults to first substep" do
        result = workflow.advance_to(step: "ads")

        expect(result).to be true
        expect(workflow.reload.step).to eq("ads")
        expect(workflow.substep).to eq("content")
      end
    end

    context "when advancement is invalid" do
      it "returns false for non-existent step" do
        result = workflow.advance_to(step: "invalid_step")

        expect(result).to be false
        expect(workflow.reload.step).not_to eq("invalid_step")
      end

      it "returns false for non-existent substep" do
        result = workflow.advance_to(step: "ads", substep: "invalid_substep")

        expect(result).to be false
        expect(workflow.reload.step).not_to eq("ads")
      end

      it "does not update the workflow when advancement fails" do
        workflow.update(step: "brainstorm", substep: nil)

        workflow.advance_to(step: "invalid_step")

        expect(workflow.reload.step).to eq("brainstorm")
      end
    end
  end

  describe "#next_steps" do
    before do
      workflow.update(step: "brainstorm", substep: nil)
    end

    context "when there are remaining steps" do
      it "returns the next step after current step" do
        expect(WorkflowConfig.next_step("launch", "brainstorm")).to eq("website")
      end

      it "returns the next step in sequence" do
        workflow.update(step: "website")
        expect(WorkflowConfig.next_step("launch", "website")).to eq("ads")
      end

      it "returns the next step from ads" do
        workflow.update(step: "ads", substep: "review")
        expect(WorkflowConfig.next_step("launch", "ads")).to eq("deploy")
      end
    end

    context "when at the last step" do
      it "returns nil when at the final step" do
        workflow.update(step: "deploy", substep: nil)
        expect(WorkflowConfig.next_step("launch", "deploy")).to be_nil
      end
    end

    context "substeps handling" do
      it "returns all substeps for ads" do
        substeps = WorkflowConfig.substeps_for("launch", "ads")
        expect(substeps).to eq(["content", "highlights", "keywords", "settings", "launch", "review"])
      end

      it "returns empty array for deploy step" do
        substeps = WorkflowConfig.substeps_for("launch", "deploy")
        expect(substeps).to eq([])
      end

      it "returns empty array for steps without substeps" do
        substeps = WorkflowConfig.substeps_for("launch", "brainstorm")
        expect(substeps).to eq([])
      end
    end
  end

  describe "#complete!" do
    it "marks workflow as completed" do
      workflow.update(status: "active")

      workflow.complete!

      expect(workflow.reload.status).to eq("completed")
    end
  end

  describe "#as_json" do
    before do
      workflow.update(step: "ads", substep: "content")
    end

    it "returns workflow data as hash" do
      json = workflow.as_json

      expect(json).to be_a(Hash)
      expect(json[:workflow_type]).to eq("launch")
      expect(json[:page]).to eq("ads")
      expect(json[:substep]).to eq("content")
    end

    it "includes progress calculation" do
      json = workflow.as_json

      expect(json).to have_key(:progress)
      expect(json[:progress]).to be_a(Numeric)
    end

    it "includes available steps" do
      json = workflow.as_json

      expect(json[:available_steps]).to eq(%w[brainstorm website ads deploy])
    end
  end

  it "allows only 1 launch workflow per project" do
    expect { create(:project_workflow, project: project, workflow_type: "launch") }.to raise_error(ActiveRecord::RecordInvalid)
  end

  describe "#calculate_progress" do
    it "does not allow nil steps" do
      workflow.update(step: nil)
      expect(workflow).to_not be_valid
    end

    it "calculates progress based on current step" do
      workflow.update(step: "brainstorm")
      expect(workflow.send(:calculate_progress)).to eq(0)

      workflow.update(step: "website")
      expect(workflow.send(:calculate_progress)).to eq(25)

      workflow.update(step: "ads")
      expect(workflow.send(:calculate_progress)).to eq(50)

      workflow.update(step: "deploy")
      expect(workflow.send(:calculate_progress)).to eq(75)
    end
  end

  describe "#chat" do
    let!(:website_chat) do
      create(:chat, project: project, account: account, chat_type: "website", thread_id: "website-thread")
    end

    it "returns the website chat when step is website/build" do
      workflow.update!(step: "website", substep: "build")
      expect(workflow.chat).to eq(website_chat)
    end

    it "returns the brainstorm chat when step is brainstorm" do
      brainstorm_chat = create(:chat, project: project, account: account, chat_type: "brainstorm", thread_id: "brainstorm-thread")
      workflow.update!(step: "brainstorm", substep: nil)
      expect(workflow.chat).to eq(brainstorm_chat)
    end

    context "deploy contexts" do
      let!(:deploy) { create(:deploy, project: project) }

      it "returns the deploy chat when substep is deploy (website/deploy)" do
        workflow.update!(step: "website", substep: "deploy")
        expect(workflow.chat).to eq(deploy.chat)
        expect(workflow.chat.chat_type).to eq("deploy")
      end

      it "returns the deploy chat when step is deploy (standalone)" do
        workflow.update!(step: "deploy", substep: nil)
        expect(workflow.chat).to eq(deploy.chat)
      end

      it "does NOT return the website chat when in deploy context" do
        workflow.update!(step: "website", substep: "deploy")
        expect(workflow.chat).not_to eq(website_chat)
      end

      it "returns nil when no deploy exists" do
        deploy.destroy!
        workflow.update!(step: "deploy", substep: nil)
        expect(workflow.chat).to be_nil
      end

      it "returns the newest deploy's chat when multiple deploys exist" do
        second_deploy = create(:deploy, project: project)
        workflow.update!(step: "deploy", substep: nil)

        expect(workflow.chat).to eq(second_deploy.chat)
        expect(deploy.chat.reload.active).to be false
      end
    end
  end

  describe "event tracking" do
    it "tracks workflow_step_reached on next_step!" do
      workflow.update(step: "brainstorm", substep: nil)
      expect(TrackEvent).to receive(:call).with("workflow_step_reached",
        hash_including(step: "website", substep: "build", previous_step: "brainstorm"))
      workflow.next_step!
    end

    it "tracks workflow_step_reached on advance_to" do
      workflow.update(step: "brainstorm", substep: nil)
      expect(TrackEvent).to receive(:call).with("workflow_step_reached",
        hash_including(step: "website", substep: "build"))
      workflow.advance_to(step: "website")
    end
  end
end
