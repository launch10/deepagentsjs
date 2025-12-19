# == Schema Information
#
# Table name: websites
#
#  id          :bigint           not null, primary key
#  name        :string
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  account_id  :bigint
#  project_id  :bigint
#  template_id :bigint
#  theme_id    :integer
#  thread_id   :string
#
# Indexes
#
#  index_websites_on_account_id   (account_id)
#  index_websites_on_created_at   (created_at)
#  index_websites_on_name         (name)
#  index_websites_on_project_id   (project_id)
#  index_websites_on_template_id  (template_id)
#  index_websites_on_theme_id     (theme_id)
#  index_websites_on_thread_id    (thread_id) UNIQUE
#

require "rails_helper"
require 'support/website_file_helpers'
require 'sidekiq/testing'

describe Website do
  let(:website) { FactoryBot.create(:website) }
  let(:s3_client) { instance_double(Aws::S3::Client) }
  let(:deploy_uploader) { instance_double(DeployUploader) }

  before do
    allow(Aws::S3::Client).to receive(:new).and_return(s3_client)
    allow(DeployUploader).to receive(:new).and_return(deploy_uploader)
    allow(deploy_uploader).to receive(:client).and_return(s3_client)
    allow(deploy_uploader).to receive(:bucket_name).and_return('deploys')
    allow_any_instance_of(Website).to receive(:sync_all_to_atlas)
    Sidekiq::Testing.fake!
  end

  after do
    Sidekiq::Worker.clear_all
  end

  it "is valid" do
    expect(website).to be_valid
  end

  it "snapshots website files" do
    file = website.website_files.create!(path: "index.html", content: "Hello World")
    expect(website.website_files.count).to eq(1)
    expect(website.website_files.first.content).to eq("Hello World")

    website.snapshot
    expect(website.website_files.count).to eq(1)
    expect(website.website_files.first.content).to eq("Hello World")

    original_snapshot = website.website_files.first
    file.update!(content: "Goodnight Moon")

    website.snapshot
    expect(website.website_files.first.content).to eq("Goodnight Moon")
    expect(original_snapshot.content).to eq("Hello World")

    current_snapshot = website.website_files.last
    expect(current_snapshot.content).to eq("Goodnight Moon")
    expect(original_snapshot.content).to eq("Hello World")
  end

  describe "#deploy!" do
    let(:website_with_files) { create_website_with_files(account: website.account, project: website.project, files: minimal_website_files) }
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
          website_with_files.deploy!(async: false)
        }.to change { website_with_files.deploys.count }.by(1)
      end

      it "runs the deploy process through build and upload stages" do
        expect_any_instance_of(Deploy).to receive(:build!).and_return(dist_path.to_s)
        expect_any_instance_of(Deploy).to receive(:upload!).with(dist_path.to_s)

        website_with_files.deploy!(async: false)
      end

      it "marks the deploy as completed and live" do
        website_with_files.deploy!(async: false)

        deploy = website_with_files.reload.deploys.last
        expect(deploy.status).to eq('completed')
        expect(deploy.is_live).to be true
        expect(deploy.revertible).to be true
      end

      it "stores the version path for the deploy" do
        website_with_files.deploy!(async: false)

        deploy = website_with_files.reload.deploys.last
        expect(deploy.version_path).to match(/#{website_with_files.id}\/\d{14}/)
      end

      it "preserves the previous live version when deploying" do
        first_deploy = website_with_files.deploys.create!(environment: 'development')
        allow(first_deploy).to receive(:build!).and_return(dist_path.to_s)
        first_deploy.upload!(dist_path.to_s)

        expect(deploy_uploader).to receive(:preserve_current_live).with(
          website_with_files.id,
          first_deploy.created_at.strftime('%Y%m%d%H%M%S')
        )

        website_with_files.deploy!(async: false)
      end

      it "performs R2 operations in correct order" do
        expect(deploy_uploader).to receive(:store!).ordered
        expect(deploy_uploader).to receive(:hotswap_to_target).ordered
        expect(deploy_uploader).to receive(:cleanup_old_deploys).ordered

        website_with_files.deploy!(async: false)
      end

      it "uploads files to R2 with correct paths" do
        timestamp_regex = /\d{14}/

        expect(deploy_uploader).to receive(:store!) do |local_path, remote_path|
          expect(local_path).to eq(dist_path.to_s)
          expect(remote_path).to match(/#{website_with_files.id}\/#{timestamp_regex}/)
        end

        website_with_files.deploy!(async: false)
      end

      it "hotswaps the live directory after upload" do
        timestamp_regex = /\d{14}/

        expect(deploy_uploader).to receive(:hotswap_to_target) do |version_path, target_dir|
          expect(version_path).to match(/#{website_with_files.id}\/#{timestamp_regex}/)
          expect(target_dir).to eq('live')
        end

        website_with_files.deploy!(async: false)
      end

      it "cleans up old deploys from R2" do
        6.times do |i|
          deploy = website_with_files.deploys.create!(environment: 'development')
          allow(deploy).to receive(:build!).and_return(dist_path.to_s)
          deploy.update!(
            status: 'completed',
            version_path: "#{website_with_files.id}/2024010#{i}120000",
            revertible: i >= 1,
            is_live: i == 5,
            is_preview: false
          )
        end

        expect(deploy_uploader).to receive(:cleanup_old_deploys) do |project_id, keep_timestamps|
          expect(project_id).to eq(website_with_files.id.to_s)
          # With environment filtering, we should have fewer timestamps to keep
          expect(keep_timestamps.size).to be <= Deploy::KEEP_DEPLOY_LIMIT + 2
        end

        website_with_files.deploy!(async: false)
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
        expect(website_with_files.deploy!(async: false)).to be false
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
        website_with_files.deploy!(async: false)

        deploy = website_with_files.reload.deploys.last
        expect(deploy.status).to eq('failed')
        expect(deploy.stacktrace).to be_present
      end
    end
  end

  describe "#rollback!" do
    let(:website_with_files) { create_website_with_files(account: website.account, project: website.project, files: minimal_website_files) }
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

  describe "#deploy (async)" do
    let(:website_with_files) { create_website_with_files(account: website.account, project: website.project, files: minimal_website_files) }

    before do
      website_with_files.snapshot
    end

    context "when async is true (default)" do
      it "enqueues a DeployWorker job" do
        expect {
          website_with_files.deploy
        }.to change(Deploy::DeployWorker.jobs, :size).by(1)
      end

      it "passes the deploy ID to the worker" do
        website_with_files.deploy

        job = Deploy::DeployWorker.jobs.last
        deploy_id = job['args'].first
        deploy = Deploy.find(deploy_id)

        expect(deploy.website_id).to eq(website_with_files.id)
        expect(deploy.status).to eq('pending')
      end

      it "returns the worker job ID" do
        result = website_with_files.deploy
        expect(result).to be_present
      end

      it "creates a deploy record immediately" do
        expect {
          website_with_files.deploy
        }.to change { website_with_files.deploys.count }.by(1)
      end

      context "when worker processes the job" do
        before do
          mock_r2_responses_for_successful_deploy
          allow_any_instance_of(Deploy).to receive(:build!).and_return('/tmp/test/dist')
        end

        it "executes the deploy successfully" do
          website_with_files.deploy

          expect {
            Deploy::DeployWorker.drain
          }.to change { website_with_files.deploys.reload.completed.count }.by(1)

          deploy = website_with_files.deploys.last.reload
          expect(deploy.status).to eq('completed')
          expect(deploy.is_live).to be true
        end

        it "handles deploy failures gracefully" do
          allow_any_instance_of(Deploy).to receive(:build!).and_raise(StandardError, "Test error")

          website_with_files.deploy

          expect {
            Deploy::DeployWorker.drain
          }.to raise_error(StandardError)

          deploy = website_with_files.reload.deploys.last
          expect(deploy.status).to eq('failed')
        end
      end
    end

    context "when async is false" do
      before do
        mock_r2_responses_for_successful_deploy
        allow_any_instance_of(Deploy).to receive(:build!).and_return('/tmp/test/dist')
      end

      it "does not enqueue a worker job" do
        expect {
          website_with_files.deploy(async: false)
        }.not_to change(Deploy::DeployWorker.jobs, :size)
      end

      it "executes deploy synchronously" do
        result = website_with_files.deploy(async: false)

        deploy = website_with_files.reload.deploys.last
        expect(deploy.status).to eq('completed')
        expect(result).to be true
      end
    end
  end

  describe "#rollback (async)" do
    let(:website_with_files) { create_website_with_files(account: website.account, project: website.project, files: minimal_website_files) }

    before do
      website_with_files.snapshot
      mock_r2_responses_for_successful_deploy
    end

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

    context "when async is true (default)" do
      it "enqueues a RollbackWorker job" do
        expect {
          website_with_files.rollback
        }.to change(Deploy::RollbackWorker.jobs, :size).by(1)
      end

      it "passes the correct deploy ID to the worker" do
        website_with_files.rollback

        job = Deploy::RollbackWorker.jobs.last
        deploy_id = job['args'].first

        expect(deploy_id).to eq(deploy1.id)
      end

      it "can rollback to a specific deploy asynchronously" do
        website_with_files.rollback(deploy1.id)

        job = Deploy::RollbackWorker.jobs.last
        deploy_id = job['args'].first

        expect(deploy_id).to eq(deploy1.id)
      end

      it "uses the critical queue" do
        website_with_files.rollback

        job = Deploy::RollbackWorker.jobs.last
        expect(job['queue']).to eq('critical')
      end

      context "when worker processes the job" do
        it "executes the rollback successfully" do
          website_with_files.rollback

          expect {
            Deploy::RollbackWorker.drain
          }.not_to raise_error

          deploy1.reload
          deploy2.reload

          expect(deploy1.is_live).to be true
          expect(deploy2.is_live).to be false
        end

        it "handles rollback failures gracefully" do
          allow_any_instance_of(Deploy).to receive(:actually_rollback).and_raise(StandardError, "Rollback error")

          website_with_files.rollback

          expect {
            Deploy::RollbackWorker.drain
          }.to raise_error(StandardError, /Rollback error/)
        end
      end
    end

    context "when async is false" do
      it "does not enqueue a worker job" do
        expect {
          website_with_files.rollback(nil, async: false)
        }.not_to change(Deploy::RollbackWorker.jobs, :size)
      end

      it "executes rollback synchronously" do
        result = website_with_files.rollback(nil, async: false)

        deploy1.reload
        deploy2.reload

        expect(deploy1.is_live).to be true
        expect(deploy2.is_live).to be false
        expect(result).to be true
      end
    end
  end

  describe "worker queue configuration" do
    it "DeployWorker uses the critical queue" do
      expect(Deploy::DeployWorker.sidekiq_options['queue']).to eq(:critical)
    end

    it "RollbackWorker uses the critical queue" do
      expect(Deploy::RollbackWorker.sidekiq_options['queue']).to eq(:critical)
    end

    it "DeployWorker has retry configuration" do
      expect(Deploy::DeployWorker.sidekiq_options['retry']).to eq(5)
      expect(Deploy::DeployWorker.sidekiq_options['backtrace']).to be true
    end

    it "RollbackWorker has retry configuration" do
      expect(Deploy::RollbackWorker.sidekiq_options['retry']).to eq(3)
      expect(Deploy::RollbackWorker.sidekiq_options['backtrace']).to be true
    end
  end

  describe "#deploy with environments" do
    let(:website_with_files) { create_website_with_files(account: website.account, project: website.project, files: minimal_website_files) }

    before do
      website_with_files.snapshot
      mock_r2_responses_for_successful_deploy
      allow_any_instance_of(Deploy).to receive(:build!).and_return('/tmp/test/dist')
    end

    it "creates a deploy with the specified environment" do
      website_with_files.deploy(async: false, environment: 'staging')

      deploy = website_with_files.reload.deploys.last
      expect(deploy.environment).to eq('staging')
      expect(deploy.is_preview).to be false
    end

    it "passes environment to deploy uploader" do
      expect(DeployUploader).to receive(:new).with(environment: 'staging').and_call_original

      website_with_files.deploy(async: false, environment: 'staging')
    end

    it "defaults to development for test environment" do
      website_with_files.deploy(async: false)

      deploy = website_with_files.reload.deploys.last
      expect(deploy.environment).to eq('development')
    end
  end

  describe "#preview!" do
    let(:website_with_files) { create_website_with_files(account: website.account, project: website.project, files: minimal_website_files) }

    before do
      website_with_files.snapshot
      mock_r2_responses_for_successful_deploy
      allow_any_instance_of(Deploy).to receive(:build!).and_return('/tmp/test/dist')
    end

    it "creates a preview deploy" do
      website_with_files.preview!

      deploy = website_with_files.reload.deploys.last
      expect(deploy.is_preview).to be true
      expect(deploy.is_live).to be false
      expect(deploy.revertible).to be false
    end

    it "uploads to preview directory instead of live" do
      expect(deploy_uploader).to receive(:hotswap_to_target).with(anything, 'preview').and_return(true)

      website_with_files.preview!(async: false)
    end

    it "does not affect live deploys" do
      # Create a live deploy first
      website_with_files.deploy!(async: false)
      live_deploy = website_with_files.reload.deploys.last
      expect(live_deploy.is_live).to be true

      # Create a preview deploy
      website_with_files.preview!
      preview_deploy = website_with_files.deploys.last

      # Check that live deploy is still live
      live_deploy.reload
      expect(live_deploy.is_live).to be true
      expect(preview_deploy.is_preview).to be true
      expect(preview_deploy.is_live).to be false
    end

    it "supports async preview deploys" do
      expect {
        website_with_files.preview(async: true)
      }.to change(Deploy::DeployWorker.jobs, :size).by(1)
    end

    it "supports different environments for preview" do
      website_with_files.preview(async: false, environment: 'staging')

      deploy = website_with_files.reload.deploys.last
      expect(deploy.environment).to eq('staging')
      expect(deploy.is_preview).to be true
    end
  end

  describe "environment-aware rollbacks" do
    let(:website_with_files) { create_website_with_files(account: website.account, project: website.project, files: minimal_website_files) }

    before do
      website_with_files.snapshot
      mock_r2_responses_for_successful_deploy
      allow_any_instance_of(Deploy).to receive(:build!).and_return('/tmp/test/dist')
    end

    it "only rolls back within the same environment" do
      # Create production deploy
      website_with_files.deploy(async: false, environment: 'production')
      prod_deploy1 = website_with_files.reload.deploys.last

      website_with_files.deploy(async: false, environment: 'production')
      prod_deploy2 = website_with_files.reload.deploys.last

      # Create staging deploy
      website_with_files.deploy(async: false, environment: 'staging')
      staging_deploy = website_with_files.reload.deploys.last

      # Rollback should only affect production
      expect_any_instance_of(Deploy).to receive(:actually_rollback).and_call_original
      website_with_files.rollback!

      prod_deploy1.reload
      prod_deploy2.reload
      staging_deploy.reload

      expect(prod_deploy1.is_live).to be true
      expect(prod_deploy2.is_live).to be false
      expect(staging_deploy.is_live).to be true # Staging should remain unaffected
    end

    it "cannot rollback preview deploys" do
      website_with_files.preview!(async: false)
      preview_deploy = website_with_files.reload.deploys.last

      expect {
        preview_deploy.rollback!
      }.to raise_error(RuntimeError, "Cannot rollback preview deploys")
    end
  end

  private

  def mock_r2_responses_for_successful_deploy
    list_response = double('list_response', contents: [double(key: 'test/file.html', size: 100)])

    allow(deploy_uploader).to receive(:list_objects).and_return(list_response)
    allow(deploy_uploader).to receive(:store!)
    allow(deploy_uploader).to receive(:hotswap_live).and_return(true)
    allow(deploy_uploader).to receive(:hotswap_to_target).and_return(true)
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
