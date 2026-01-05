# == Schema Information
#
# Table name: project_workflows
#
#  id            :bigint           not null, primary key
#  data          :jsonb
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
      expect(workflow.reload.substep).to be_nil

      workflow.next_step!
      expect(workflow.reload.step).to eq("ad_campaign")
      expect(workflow.reload.substep).to eq("content")

      workflow.next_step!
      expect(workflow.reload.step).to eq("ad_campaign")
      expect(workflow.reload.substep).to eq("highlights")

      workflow.next_step!
      expect(workflow.reload.step).to eq("ad_campaign")
      expect(workflow.reload.substep).to eq("keywords")

      workflow.next_step!
      expect(workflow.reload.step).to eq("ad_campaign")
      expect(workflow.reload.substep).to eq("settings")

      workflow.next_step!
      expect(workflow.reload.step).to eq("ad_campaign")
      expect(workflow.reload.substep).to eq("launch")

      workflow.next_step!
      expect(workflow.reload.step).to eq("ad_campaign")
      expect(workflow.reload.substep).to eq("review")

      workflow.next_step!
      expect(workflow.reload.step).to eq("launch")
      expect(workflow.reload.substep).to eq("settings")

      workflow.next_step!
      expect(workflow.reload.step).to eq("launch")
      expect(workflow.reload.substep).to eq("review")

      workflow.next_step!
      expect(workflow.reload.step).to eq("launch")
      expect(workflow.reload.substep).to eq("deployment")

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
        expect(workflow.substep).to be_nil
      end

      it "advances to a valid step with substep" do
        result = workflow.advance_to(step: "ad_campaign", substep: "content")

        expect(result).to be true
        expect(workflow.reload.step).to eq("ad_campaign")
        expect(workflow.substep).to eq("content")
      end

      it "advances through multiple substeps in order" do
        workflow.advance_to(step: "ad_campaign", substep: "content")
        expect(workflow.substep).to eq("content")

        workflow.advance_to(step: "ad_campaign", substep: "highlights")
        expect(workflow.reload.substep).to eq("highlights")

        workflow.advance_to(step: "ad_campaign", substep: "keywords")
        expect(workflow.reload.substep).to eq("keywords")
      end

      it "defaults to first substep" do
        result = workflow.advance_to(step: "ad_campaign")

        expect(result).to be true
        expect(workflow.reload.step).to eq("ad_campaign")
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
        result = workflow.advance_to(step: "ad_campaign", substep: "invalid_substep")

        expect(result).to be false
        expect(workflow.reload.step).not_to eq("ad_campaign")
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
        expect(WorkflowConfig.next_step("launch", "website")).to eq("ad_campaign")
      end

      it "returns the next step from ad_campaign" do
        workflow.update(step: "ad_campaign", substep: "launch")
        expect(WorkflowConfig.next_step("launch", "ad_campaign")).to eq("launch")
      end
    end

    context "when at the last step" do
      it "returns nil when at the final step" do
        workflow.update(step: "launch", substep: "deployment")
        expect(WorkflowConfig.next_step("launch", "launch")).to be_nil
      end
    end

    context "substeps handling" do
      it "returns all substeps for ad_campaign" do
        substeps = WorkflowConfig.substeps_for("launch", "ad_campaign")
        expect(substeps).to eq(["content", "highlights", "keywords", "settings", "launch", "review"])
      end

      it "returns all substeps for launch step" do
        substeps = WorkflowConfig.substeps_for("launch", "launch")
        expect(substeps).to eq(["settings", "review", "deployment"])
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
      workflow.update(step: "ad_campaign", substep: "content")
    end

    it "returns workflow data as hash" do
      json = workflow.as_json

      expect(json).to be_a(Hash)
      expect(json[:workflow_type]).to eq("launch")
      expect(json[:page]).to eq("ad_campaign")
      expect(json[:substep]).to eq("content")
    end

    it "includes progress calculation" do
      json = workflow.as_json

      expect(json).to have_key(:progress)
      expect(json[:progress]).to be_a(Numeric)
    end

    it "includes available steps" do
      json = workflow.as_json

      expect(json[:available_steps]).to eq(%w[brainstorm website ad_campaign launch])
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

      workflow.update(step: "ad_campaign")
      expect(workflow.send(:calculate_progress)).to eq(50)

      workflow.update(step: "launch")
      expect(workflow.send(:calculate_progress)).to eq(75)
    end
  end
end
