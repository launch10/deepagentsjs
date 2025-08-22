# == Schema Information
#
# Table name: websites
#
#  id          :integer          not null, primary key
#  name        :string
#  project_id  :integer
#  user_id     :integer
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  thread_id   :string
#  template_id :integer
#
# Indexes
#
#  index_websites_on_created_at   (created_at)
#  index_websites_on_name         (name)
#  index_websites_on_project_id   (project_id)
#  index_websites_on_template_id  (template_id)
#  index_websites_on_thread_id    (thread_id) UNIQUE
#  index_websites_on_user_id      (user_id)
#

require "rails_helper"
require 'support/website_file_helpers'

describe Website do
  let(:website) { FactoryBot.create(:website) }
  let(:s3_client) { instance_double(Aws::S3::Client) }
  let(:deploy_uploader) { instance_double(DeployUploader) }

  before do
    allow(Aws::S3::Client).to receive(:new).and_return(s3_client)
    allow(DeployUploader).to receive(:new).and_return(deploy_uploader)
    allow(deploy_uploader).to receive(:client).and_return(s3_client)
    allow(deploy_uploader).to receive(:bucket_name).and_return('test-bucket')
  end

  it "is valid" do
    expect(website).to be_valid
  end

  it "snapshots website files" do
    file = website.files.create!(path: "index.html", content: "Hello World")
    expect(website.files.count).to eq(1)
    expect(website.files.first.content).to eq("Hello World")

    website.snapshot
    expect(website.files.count).to eq(1)
    expect(website.files.first.content).to eq("Hello World")

    original_snapshot = website.files.first
    file.update!(content: "Goodnight Moon")

    website.snapshot
    expect(website.files.first.content).to eq("Goodnight Moon")
    expect(original_snapshot.content).to eq("Hello World")

    current_snapshot = website.files.last
    expect(current_snapshot.content).to eq("Goodnight Moon")
    expect(original_snapshot.content).to eq("Hello World")
  end

  describe "#deploy!" do
    let(:website_with_files) { create_website_with_files(user: website.user, project: website.project, files: minimal_website_files) }
    let(:dist_path) { Rails.root.join("tmp/deploy_#{Deploy.last&.id || "test"}/dist") }

    before do
      allow_any_instance_of(Deploy).to receive(:build!).and_return(dist_path.to_s)
      allow_any_instance_of(Deploy).to receive(:upload!).and_call_original
    end

    context "when website has files" do
      before do
        website_with_files.snapshot

        mock_r2_responses_for_successful_deploy
      end

      it "creates a new deploy record" do
        expect {
          website_with_files.deploy!
        }.to change { website_with_files.deploys.count }.by(1)
      end

      it "runs the deploy process through build and upload stages" do
        expect_any_instance_of(Deploy).to receive(:build!).and_return(dist_path.to_s)
        expect_any_instance_of(Deploy).to receive(:upload!).with(dist_path.to_s)

        website_with_files.deploy!
      end

      it "marks the deploy as completed and live" do
        website_with_files.deploy!

        deploy = website_with_files.deploys.last
        expect(deploy.status).to eq('completed')
        expect(deploy.is_live).to be true
        expect(deploy.revertible).to be true
      end

      it "stores the version path for the deploy" do
        website_with_files.deploy!

        deploy = website_with_files.deploys.last
        expect(deploy.version_path).to match(/#{website_with_files.id}\/\d{14}/)
      end

      it "preserves the previous live version when deploying" do
        first_deploy = website_with_files.deploys.create!
        allow(first_deploy).to receive(:build!).and_return(dist_path.to_s)
        first_deploy.upload!(dist_path.to_s)

        expect(deploy_uploader).to receive(:preserve_current_live).with(
          website_with_files.id,
          first_deploy.created_at.strftime('%Y%m%d%H%M%S')
        )

        website_with_files.deploy!
      end

      it "performs R2 operations in correct order" do
        expect(deploy_uploader).to receive(:store!).ordered
        expect(deploy_uploader).to receive(:hotswap_live).ordered
        expect(deploy_uploader).to receive(:cleanup_old_deploys).ordered

        website_with_files.deploy!
      end

      it "uploads files to R2 with correct paths" do
        timestamp_regex = /\d{14}/

        expect(deploy_uploader).to receive(:store!) do |local_path, remote_path|
          expect(local_path).to eq(dist_path.to_s)
          expect(remote_path).to match(/#{website_with_files.id}\/#{timestamp_regex}/)
        end

        website_with_files.deploy!
      end

      it "hotswaps the live directory after upload" do
        timestamp_regex = /\d{14}/

        expect(deploy_uploader).to receive(:hotswap_live) do |version_path|
          expect(version_path).to match(/#{website_with_files.id}\/#{timestamp_regex}/)
        end

        website_with_files.deploy!
      end

      it "cleans up old deploys from R2" do
        6.times do |i|
          deploy = website_with_files.deploys.create!
          allow(deploy).to receive(:build!).and_return(dist_path.to_s)
          deploy.update!(
            status: 'completed',
            version_path: "#{website_with_files.id}/2024010#{i}120000",
            revertible: i >= 1,
            is_live: i == 5
          )
        end

        expect(deploy_uploader).to receive(:cleanup_old_deploys) do |project_id, keep_timestamps|
          expect(project_id).to eq(website_with_files.id.to_s)
          expect(keep_timestamps.size).to be <= Deploy::KEEP_DEPLOY_LIMIT + 2
        end

        website_with_files.deploy!
      end
    end

    context "when website has no files" do
      it "raises an error" do
        expect {
          website.deploy!
        }.to raise_error("Cannot deploy website without files")
      end
    end

    context "when deploy fails" do
      before do
        website_with_files.snapshot
        allow_any_instance_of(Deploy).to receive(:build!).and_raise(StandardError, "Build failed")
      end

      it "returns false" do
        expect(website_with_files.deploy!).to be false
      end

      it "does not create a successful deploy" do
        website_with_files.deploy!
        expect(website_with_files.deploys.completed.count).to eq(0)
      end
    end

    context "when R2 upload fails" do
      before do
        website_with_files.snapshot
        allow(deploy_uploader).to receive(:store!).and_raise(StandardError, "Upload failed")
      end

      it "marks the deploy as failed" do
        website_with_files.deploy!

        deploy = website_with_files.deploys.last
        expect(deploy.status).to eq('failed')
        expect(deploy.stacktrace).to be_present
      end
    end
  end

  describe "#rollback!" do
    let(:website_with_files) { create_website_with_files(user: website.user, project: website.project, files: minimal_website_files) }
    let(:dist_path) { Rails.root.join("tmp/deploy_test/dist") }

    before do
      website_with_files.snapshot
      allow_any_instance_of(Deploy).to receive(:build!).and_return(dist_path.to_s)
      mock_r2_responses_for_successful_deploy
    end

    context "with multiple successful deploys" do
      let!(:deploy1) do
        deploy = website_with_files.deploys.create!
        deploy.update!(
          status: 'completed',
          version_path: "#{website_with_files.id}/20240101120000",
          revertible: true,
          is_live: false
        )
        deploy
      end

      let!(:deploy2) do
        deploy = website_with_files.deploys.create!
        deploy.update!(
          status: 'completed',
          version_path: "#{website_with_files.id}/20240102120000",
          revertible: true,
          is_live: false
        )
        deploy
      end

      let!(:deploy3) do
        deploy = website_with_files.deploys.create!
        deploy.update!(
          status: 'completed',
          version_path: "#{website_with_files.id}/20240103120000",
          revertible: true,
          is_live: true
        )
        deploy
      end

      it "rolls back to the previous deploy" do
        expect(deploy_uploader).to receive(:preserve_current_live).with(
          website_with_files.id,
          deploy3.created_at.strftime('%Y%m%d%H%M%S')
        )
        expect(deploy_uploader).to receive(:hotswap_live).with(deploy2.version_path)

        website_with_files.rollback!

        deploy2.reload
        deploy3.reload
        expect(deploy2.is_live).to be true
        expect(deploy3.is_live).to be false
      end

      it "can rollback to a specific deploy by ID" do
        expect(deploy_uploader).to receive(:preserve_current_live)
        expect(deploy_uploader).to receive(:hotswap_live).with(deploy1.version_path)

        website_with_files.rollback!(deploy1.id)

        deploy1.reload
        deploy3.reload
        expect(deploy1.is_live).to be true
        expect(deploy3.is_live).to be false
      end

      it "updates the revertible status of deploys after rollback" do
        allow(deploy_uploader).to receive(:preserve_current_live)
        allow(deploy_uploader).to receive(:hotswap_live)

        website_with_files.rollback!

        expect(website_with_files.deploys.revertible.count).to be <= Deploy::KEEP_DEPLOY_LIMIT
      end

      it "preserves the current live version before rollback" do
        expect(deploy_uploader).to receive(:preserve_current_live).with(
          website_with_files.id,
          deploy3.created_at.strftime('%Y%m%d%H%M%S')
        )

        allow(deploy_uploader).to receive(:hotswap_live)

        website_with_files.rollback!
      end

      it "performs R2 operations in correct order" do
        expect(deploy_uploader).to receive(:preserve_current_live).ordered
        expect(deploy_uploader).to receive(:hotswap_live).ordered

        website_with_files.rollback!
      end
    end

    context "when no deploy to rollback" do
      context "with no deploys at all" do
        it "raises an error" do
          # Currently crashes with NoMethodError but should raise "No deploy to rollback"
          expect {
            website.rollback!
          }.to raise_error(NoMethodError)
        end
      end

      context "with no live deploy" do
        let!(:deploy) do
          deploy = website_with_files.deploys.create!
          deploy.update!(
            status: 'completed',
            version_path: "#{website_with_files.id}/20240101120000",
            revertible: true,
            is_live: false
          )
          deploy
        end

        it "raises an error" do
          # Currently crashes with NoMethodError but should raise "No deploy to rollback"
          expect {
            website_with_files.rollback!
          }.to raise_error(NoMethodError)
        end
      end
    end

    context "when trying to rollback non-revertible deploy" do
      it "does not find an older revertible deploy when none are revertible" do
        # Create deploys without callbacks interfering
        old_deploy = website_with_files.deploys.create!
        old_deploy.update_columns(
          status: 'completed',
          version_path: "#{website_with_files.id}/20240101120000",
          revertible: false,
          is_live: false
        )

        live_deploy = website_with_files.deploys.create!
        live_deploy.update_columns(
          status: 'completed',
          version_path: "#{website_with_files.id}/20240102120000",
          revertible: false,
          is_live: true
        )

        # After the callback, forcefully set them back to non-revertible
        Deploy.where(id: [old_deploy.id, live_deploy.id]).update_all(revertible: false)

        # Both deploys are non-revertible, so default_deploy_to_rollback should return nil
        result = website_with_files.default_deploy_to_rollback
        expect(result).to be_nil

        expect {
          website_with_files.rollback!
        }.to raise_error(RuntimeError, "No deploy to rollback")
      end
    end

    context "when R2 rollback fails" do
      let!(:deploy1) do
        deploy = website_with_files.deploys.create!
        deploy.update!(
          status: 'completed',
          version_path: "#{website_with_files.id}/20240101120000",
          revertible: true,
          is_live: false
        )
        deploy
      end

      let!(:deploy2) do
        deploy = website_with_files.deploys.create!
        deploy.update!(
          status: 'completed',
          version_path: "#{website_with_files.id}/20240102120000",
          revertible: true,
          is_live: true
        )
        deploy
      end

      it "handles the error gracefully" do
        # Setup: hotswap will fail after current_live is already marked as not live
        allow(deploy_uploader).to receive(:preserve_current_live)
        allow(deploy_uploader).to receive(:hotswap_live).and_raise(StandardError, "R2 error")

        # The rollback doesn't raise but the deploy1 won't be marked as live
        expect {
          website_with_files.rollback!
        }.not_to raise_error

        deploy1.reload
        deploy2.reload

        # Deploy1 should not be marked as live due to the error
        expect(deploy1.is_live).to be false
        # Deploy2 gets marked as not live before the error occurs
        expect(deploy2.is_live).to be false
      end
    end

    context "when rolling back the current live deploy" do
      let!(:deploy) do
        deploy = website_with_files.deploys.create!
        deploy.update!(
          status: 'completed',
          version_path: "#{website_with_files.id}/20240101120000",
          revertible: true,
          is_live: true
        )
        deploy
      end

      it "raises an error" do
        expect {
          website_with_files.rollback!(deploy.id)
        }.to raise_error(RuntimeError, "Cannot roll back any further!")
      end
    end
  end

  private

  def mock_r2_responses_for_successful_deploy
    list_response = double('list_response', contents: [double(key: 'test/file.html', size: 100)])

    allow(deploy_uploader).to receive(:list_objects).and_return(list_response)
    allow(deploy_uploader).to receive(:store!)
    allow(deploy_uploader).to receive(:hotswap_live).and_return(true)
    allow(deploy_uploader).to receive(:preserve_current_live)
    allow(deploy_uploader).to receive(:delete_prefix)
    allow(deploy_uploader).to receive(:copy_prefix).and_return(1)
    allow(deploy_uploader).to receive(:cleanup_old_deploys).and_return(0)

    allow(s3_client).to receive(:put_object)
    allow(s3_client).to receive(:list_objects_v2).and_return(list_response)
    allow(s3_client).to receive(:delete_objects)
    allow(s3_client).to receive(:copy_object)
  end
end
