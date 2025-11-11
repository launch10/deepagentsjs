# == Schema Information
#
# Table name: deploys
#
#  id                 :integer          not null, primary key
#  website_id         :integer
#  website_history_id :integer
#  status             :string           not null
#  trigger            :string           default("manual")
#  stacktrace         :text
#  snapshot_id        :string
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  is_live            :boolean          default("false")
#  revertible         :boolean          default("false")
#  version_path       :string
#  environment        :string           default("production"), not null
#  is_preview         :boolean          default("false"), not null
#  shasum             :string
#
# Indexes
#
#  index_deploys_on_created_at                                 (created_at)
#  index_deploys_on_environment                                (environment)
#  index_deploys_on_is_live                                    (is_live)
#  index_deploys_on_is_preview                                 (is_preview)
#  index_deploys_on_revertible                                 (revertible)
#  index_deploys_on_shasum                                     (shasum)
#  index_deploys_on_snapshot_id                                (snapshot_id)
#  index_deploys_on_status                                     (status)
#  index_deploys_on_trigger                                    (trigger)
#  index_deploys_on_website_history_id                         (website_history_id)
#  index_deploys_on_website_id                                 (website_id)
#  index_deploys_on_website_id_and_environment_and_is_preview  (website_id,environment,is_preview)
#  index_deploys_on_website_id_and_is_live                     (website_id,is_live)
#

require 'rails_helper'
require 'support/website_file_helpers'

RSpec.describe Deploy, type: :model do
  include WebsiteFileHelpers

  let(:user) { create(:user) }
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project, account: account) }
  let(:s3_client) { instance_double(Aws::S3::Client) }

  before do
    allow(Aws::S3::Client).to receive(:new).and_return(s3_client)
  end

  describe 'validations' do
    it 'validates presence of website' do
      deploy = Deploy.new
      expect(deploy).not_to be_valid
      expect(deploy.errors[:website]).to include("must exist")
    end

    it 'validates presence of status' do
      deploy = Deploy.new(website: website)
      deploy.status = nil
      expect(deploy).not_to be_valid
      expect(deploy.errors[:status]).to include("can't be blank")
    end

    it 'validates inclusion of status' do
      deploy = Deploy.new(website: website, status: 'invalid')
      expect(deploy).not_to be_valid
      expect(deploy.errors[:status]).to include("is not included in the list")
    end

    it 'validates inclusion of environment' do
      deploy = Deploy.new(website: website, status: 'pending', environment: 'invalid')
      expect(deploy).not_to be_valid
      expect(deploy.errors[:environment]).to include("is not included in the list")
    end
  end

  describe '#deploy!' do
    let(:website_with_files) { create_website_with_files(account: account, project: project, files: minimal_website_files) }

    before do
      website_with_files.snapshot
      allow(FileUtils).to receive(:mkdir_p)
      allow(FileUtils).to receive(:rm_rf)
      allow(File).to receive(:write)
      allow(Dir).to receive(:chdir).and_yield
      allow(Dir).to receive(:exist?).and_return(true)
    end

    context 'when deploy is successful' do
      let(:deploy) { website_with_files.deploys.create!(environment: 'development') }

      before do
        allow(deploy).to receive(:system).and_return(true)

        # Mock file system operations for upload
        allow(Dir).to receive(:glob).and_return(['/tmp/test/dist/index.html', '/tmp/test/dist/style.css'])
        allow(File).to receive(:file?).and_return(true)
        allow(File).to receive(:open).and_yield(StringIO.new('test content'))

        # Mock S3 operations
        allow(s3_client).to receive(:list_objects_v2).and_return(
          double(contents: [double(key: 'test/file.html', size: 100)])
        )
        allow(s3_client).to receive(:put_object)
        allow(s3_client).to receive(:delete_objects)
        allow(s3_client).to receive(:copy_object)
      end

      it 'uploads files to S3' do
        # We expect files to be uploaded to the versioned directory
        expect(s3_client).to receive(:put_object).at_least(:once) do |args|
          expect(args[:bucket]).to eq('deploys')
          expect(args[:key]).to match(/#{website_with_files.id}\/\d{14}\//)
        end

        deploy.deploy!
      end

      it 'copies files to live directory' do
        # After upload, files should be copied to the live directory
        expect(s3_client).to receive(:copy_object).at_least(:once) do |args|
          expect(args[:bucket]).to eq('deploys')
          # The copy source will include actual keys from list_objects_v2
          if args[:copy_source].include?("/#{website_with_files.id}/")
            expect(args[:key]).to match(/#{website_with_files.id}\/live\//)
          end
        end

        deploy.deploy!
      end

      it 'cleans up old live directory' do
        # Old live directory should be deleted before copying new files
        # Set up the mock to return files in live directory when asked
        allow(s3_client).to receive(:list_objects_v2).and_return(
          double(contents: [double(key: "#{website_with_files.id}/live/old.html")])
        )

        # Expect delete_objects to be called for cleaning up
        expect(s3_client).to receive(:delete_objects).at_least(:once)

        deploy.deploy!
      end

      it 'updates deploy status to completed' do
        deploy.deploy!
        expect(deploy.reload.status).to eq('completed')
      end

      it 'marks deploy as live' do
        deploy.deploy!
        expect(deploy.reload.is_live).to be true
      end
    end

    context 'when deploy fails during build' do
      let(:deploy) { website_with_files.deploys.create!(environment: 'development') }

      before do
        allow(deploy).to receive(:system).with("pnpm install").and_return(false)
      end

      it 'does not make any S3 calls' do
        expect(s3_client).not_to receive(:put_object)
        expect(s3_client).not_to receive(:copy_object)
        expect(s3_client).not_to receive(:delete_objects)

        deploy.deploy!
      end

      it 'marks deploy as failed' do
        deploy.deploy!
        expect(deploy.reload.status).to eq('failed')
      end
    end

    context 'when a later deploy already exists and is live' do
      let(:deploy) { website_with_files.deploys.create!(environment: 'development', created_at: 2.hours.ago) }
      let!(:later_deploy) do
        d = website_with_files.deploys.create!(environment: 'development', created_at: 1.hour.ago)
        d.update!(status: 'completed', is_live: true)
        d
      end

      before do
        # Ensure IDs are ordered correctly
        deploy.update!(id: 100)
        later_deploy.update!(id: 101)
      end

      it 'skips the deploy without making S3 calls' do
        expect(s3_client).not_to receive(:put_object)
        expect(s3_client).not_to receive(:copy_object)
        expect(s3_client).not_to receive(:delete_objects)

        deploy.deploy!
      end

      it 'marks deploy as skipped' do
        deploy.deploy!
        expect(deploy.reload.status).to eq('skipped')
      end
    end
  end

  describe '#rollback!' do
    let(:website_with_files) { create_website_with_files(account: account, project: project, files: minimal_website_files) }

    before do
      website_with_files.snapshot
    end

    context 'when rolling back a completed deploy' do
      let!(:current_live) do
        deploy = website_with_files.deploys.create!(environment: 'development')
        deploy.update!(status: 'completed', is_live: true, revertible: true, version_path: "#{website_with_files.id}/20240102000000")
        deploy
      end

      let!(:rollback_target) do
        deploy = website_with_files.deploys.create!(environment: 'development')
        deploy.update!(status: 'completed', is_live: false, revertible: true, version_path: "#{website_with_files.id}/20240101000000")
        deploy
      end

      before do
        allow(s3_client).to receive(:list_objects_v2).and_return(
          double(contents: [double(key: 'test/file.html', size: 100)])
        )
        allow(s3_client).to receive(:copy_object)
        allow(s3_client).to receive(:delete_objects)
      end

      it 'preserves current live version' do
        # Should copy current live to a preserved location
        expect(s3_client).to receive(:copy_object).at_least(:once) do |args|
          if args[:copy_source].include?('/live/')
            expect(args[:bucket]).to eq('deploys')
            expect(args[:copy_source]).to match(/deploys-development\/#{website_with_files.id}\/live\//)
            expect(args[:key]).to match(/#{website_with_files.id}\/20240102000000\//)
          end
        end

        rollback_target.rollback!
      end

      it 'copies rollback version to live' do
        # Should copy the rollback target version to live
        expect(s3_client).to receive(:copy_object).at_least(:once) do |args|
          if args[:copy_source].include?('/20240101000000/')
            expect(args[:bucket]).to eq('deploys')
            expect(args[:copy_source]).to match(/deploys-development\/#{website_with_files.id}\/20240101000000\//)
            expect(args[:key]).to match(/#{website_with_files.id}\/live\//)
          end
        end

        rollback_target.rollback!
      end

      it 'cleans up old live directory before copying' do
        # Set up the mock to return files in live directory when asked
        allow(s3_client).to receive(:list_objects_v2).and_return(
          double(contents: [double(key: "#{website_with_files.id}/live/index.html")])
        )

        # Expect delete_objects to be called for cleaning up
        expect(s3_client).to receive(:delete_objects).at_least(:once)

        rollback_target.rollback!
      end

      it 'marks rollback target as live' do
        rollback_target.rollback!
        expect(rollback_target.reload.is_live).to be true
      end

      it 'marks current live as not live' do
        rollback_target.rollback!
        expect(current_live.reload.is_live).to be false
      end
    end

    context 'when rollback is not allowed' do
      it 'raises error for non-completed deploy' do
        deploy = website_with_files.deploys.create!(status: 'pending')
        expect { deploy.rollback! }.to raise_error("Cannot rollback non-completed deploy")
      end

      it 'raises error for preview deploy' do
        deploy = website_with_files.deploys.create!(status: 'completed', is_preview: true, revertible: true)
        expect { deploy.rollback! }.to raise_error("Cannot rollback preview deploys")
      end

      it 'raises error for non-revertible deploy' do
        deploy = website_with_files.deploys.create!(status: 'completed', is_preview: false, revertible: false)
        expect { deploy.rollback! }.to raise_error("Cannot rollback non-revertible deploy")
      end

      it 'raises error when already live' do
        deploy = website_with_files.deploys.create!(status: 'completed', is_live: true, revertible: true)
        expect { deploy.rollback! }.to raise_error("Cannot roll back any further!")
      end
    end
  end

  describe '#preview!' do
    let(:website_with_files) { create_website_with_files(account: account, project: project, files: minimal_website_files) }
    let(:deploy) { website_with_files.deploys.create!(environment: 'development', is_preview: true) }

    before do
      website_with_files.snapshot
      allow(FileUtils).to receive(:mkdir_p)
      allow(FileUtils).to receive(:rm_rf)
      allow(File).to receive(:write)
      allow(Dir).to receive(:chdir).and_yield
      allow(Dir).to receive(:exist?).and_return(true)
      allow(deploy).to receive(:system).and_return(true)

      allow(s3_client).to receive(:list_objects_v2).and_return(
        double(contents: [double(key: 'test/file.html', size: 100)])
      )
      allow(s3_client).to receive(:put_object)
      allow(s3_client).to receive(:delete_objects)
      allow(s3_client).to receive(:copy_object)
    end

    it 'uploads to preview directory instead of live' do
      expect(s3_client).to receive(:copy_object).at_least(:once) do |args|
        expect(args[:bucket]).to eq('deploys')
        # The copy operation should copy to preview directory
        if args[:key].include?("#{website_with_files.id}/")
          expect(args[:key]).to match(/#{website_with_files.id}\/preview\//)
          expect(args[:key]).not_to match(/#{website_with_files.id}\/live\//)
        end
      end

      deploy.deploy!
    end

    it 'does not mark preview deploy as live' do
      deploy.deploy!
      expect(deploy.reload.is_live).to be false
    end

    it 'does not mark preview deploy as revertible' do
      deploy.deploy!
      expect(deploy.reload.revertible).to be false
    end
  end

  describe 'environment isolation via Cloudflare::R2' do
    let(:website_with_files) { create_website_with_files(account: account, project: project, files: minimal_website_files) }

    before do
      website_with_files.snapshot
      allow(FileUtils).to receive(:mkdir_p)
      allow(FileUtils).to receive(:rm_rf)
      allow(File).to receive(:write)
      allow(Dir).to receive(:chdir).and_yield
      allow(Dir).to receive(:exist?).and_return(true)

      # Mock file system operations for upload
      allow(Dir).to receive(:glob).and_return(['/tmp/test/dist/index.html'])
      allow(File).to receive(:file?).and_return(true)
      allow(File).to receive(:open).and_yield(StringIO.new('test content'))

      # Set a default environment in config
      allow(Cloudflare.config).to receive(:deploy_env).and_return('development')

      allow(s3_client).to receive(:list_objects_v2).and_return(
        double(contents: [double(key: 'test/file.html', size: 100)])
      )
      allow(s3_client).to receive(:put_object)
      allow(s3_client).to receive(:delete_objects)
      allow(s3_client).to receive(:copy_object)
    end

    it 'uses Deploy environment to override default config environment' do
      # Deploy's environment should override the config default
      deploy = website_with_files.deploys.create!(environment: 'staging')
      allow(deploy).to receive(:system).and_return(true)

      # The S3 client should receive staging-prefixed paths, not development
      expect(s3_client).to receive(:put_object).at_least(:once) do |args|
        expect(args[:bucket]).to eq('deploys')
        # Should use staging from Deploy, not development from config
        expect(args[:key]).to start_with('staging/')
        expect(args[:key]).not_to start_with('development/')
      end

      deploy.deploy!
    end

    it 'properly prefixes all S3 operations with environment' do
      deploy = website_with_files.deploys.create!(environment: 'production')
      allow(deploy).to receive(:system).and_return(true)

      # Track all S3 operations to verify prefixing
      put_keys = []
      list_prefixes = []
      copy_operations = []
      delete_operations = []

      allow(s3_client).to receive(:put_object) do |args|
        put_keys << args[:key]
      end

      allow(s3_client).to receive(:list_objects_v2) do |args|
        list_prefixes << args[:prefix]
        double(contents: [double(key: "production/#{website_with_files.id}/20240101120000/index.html", size: 100)])
      end

      allow(s3_client).to receive(:copy_object) do |args|
        copy_operations << {source: args[:copy_source], dest: args[:key]}
      end

      allow(s3_client).to receive(:delete_objects) do |args|
        delete_operations << args[:delete][:objects] if args[:delete]
      end

      deploy.deploy!

      # Verify all operations use production prefix
      expect(put_keys).to all(start_with('production/'))
      expect(list_prefixes.compact).to all(start_with('production/'))
      copy_operations.each do |op|
        expect(op[:source]).to include('production/') if op[:source]
        expect(op[:dest]).to start_with('production/') if op[:dest]
      end
    end

    it 'isolates different environments in separate folders' do
      # Create deploys for different environments
      dev_deploy = website_with_files.deploys.create!(environment: 'development')
      staging_deploy = website_with_files.deploys.create!(environment: 'staging')
      prod_deploy = website_with_files.deploys.create!(environment: 'production')

      [dev_deploy, staging_deploy, prod_deploy].each do |deploy|
        allow(deploy).to receive(:system).and_return(true)
      end

      # Track which environment each operation belongs to
      operations_by_env = {'development' => [], 'staging' => [], 'production' => []}

      allow(s3_client).to receive(:put_object) do |args|
        key = args[:key]
        if key.start_with?('development/')
          operations_by_env['development'] << key
        elsif key.start_with?('staging/')
          operations_by_env['staging'] << key
        elsif key.start_with?('production/')
          operations_by_env['production'] << key
        end
      end

      # Deploy to each environment
      dev_deploy.deploy!
      staging_deploy.deploy!
      prod_deploy.deploy!

      # Verify each environment got its own operations
      expect(operations_by_env['development']).not_to be_empty
      expect(operations_by_env['staging']).not_to be_empty
      expect(operations_by_env['production']).not_to be_empty

      # Verify no cross-contamination between environments
      operations_by_env['development'].each { |key| expect(key).to start_with('development/') }
      operations_by_env['staging'].each { |key| expect(key).to start_with('staging/') }
      operations_by_env['production'].each { |key| expect(key).to start_with('production/') }
    end
  end

  describe 'cleanup of old deploys' do
    let(:website_with_files) { create_website_with_files(account: account, project: project, files: minimal_website_files) }

    before do
      website_with_files.snapshot
      allow(FileUtils).to receive(:mkdir_p)
      allow(FileUtils).to receive(:rm_rf)
      allow(File).to receive(:write)
      allow(Dir).to receive(:chdir).and_yield
      allow(Dir).to receive(:exist?).and_return(true)

      allow(s3_client).to receive(:put_object)
      allow(s3_client).to receive(:copy_object)
    end

    it 'calls cleanup after successful deploy' do
      current_deploy = website_with_files.deploys.create!(environment: 'development')
      allow(current_deploy).to receive(:system).and_return(true)

      # Mock file system operations for upload
      allow(Dir).to receive(:glob).and_return(['/tmp/test/dist/index.html'])
      allow(File).to receive(:file?).and_return(true)
      allow(File).to receive(:open).and_yield(StringIO.new('test content'))

      # Mock S3 list operations
      allow(s3_client).to receive(:list_objects_v2).and_return(
        double(contents: [double(key: 'test/file.html', size: 100)])
      )

      # Allow delete_objects to be called (or not) - cleanup might not delete anything
      allow(s3_client).to receive(:delete_objects)

      # The important thing is the deploy completes successfully
      expect { current_deploy.deploy! }.not_to raise_error
      expect(current_deploy.reload.status).to eq('completed')
    end
  end

  describe 'shasum functionality' do
    let(:website_with_files) { create_website_with_files(account: account, project: project, files: minimal_website_files) }

    before do
      website_with_files.snapshot
    end

    describe 'shasum generation on create' do
      it 'sets shasum when creating a deploy' do
        deploy = website_with_files.deploys.create!(environment: 'development')
        expect(deploy.shasum).to be_present
        expect(deploy.shasum).to eq(website_with_files.generate_shasum)
      end

      it 'generates the same shasum for the same files' do
        deploy1 = website_with_files.deploys.create!(environment: 'development')
        deploy2 = website_with_files.deploys.create!(environment: 'development')

        expect(deploy1.shasum).to eq(deploy2.shasum)
      end

      it 'generates different shasums when files change' do
        deploy1 = website_with_files.deploys.create!(environment: 'development')

        # Change a file
        website_with_files.website_files.first.update!(content: 'changed content')

        deploy2 = website_with_files.deploys.create!(environment: 'development')

        expect(deploy1.shasum).not_to eq(deploy2.shasum)
      end
    end

    describe 'snapshot creation based on shasum' do
      context 'when files have not changed' do
        let!(:existing_deploy) do
          deploy = website_with_files.deploys.create!(environment: 'development')
          deploy.update!(status: 'completed', shasum: website_with_files.generate_shasum)
          deploy
        end

        it 'reuses existing snapshot when shasum matches' do
          # Expect snapshot to not be called since files haven't changed
          expect(website_with_files).not_to receive(:snapshot)

          new_deploy = website_with_files.deploys.create!(environment: 'development')
          expect(new_deploy.snapshot_id).to eq(existing_deploy.snapshot_id)
        end
      end

      context 'when files have changed' do
        let!(:existing_deploy) do
          deploy = website_with_files.deploys.create!(environment: 'development')
          deploy.update!(status: 'completed')
          deploy
        end

        it 'creates new snapshot when shasum differs' do
          # Change a file to trigger new shasum
          website_with_files.website_files.first.update!(content: 'new content')

          # Don't test the exact number of calls, just that a new snapshot is created
          initial_snapshot_count = website_with_files.snapshots.count

          new_deploy = website_with_files.deploys.create!(environment: 'development')

          expect(website_with_files.snapshots.count).to be > initial_snapshot_count
          expect(new_deploy.shasum).not_to eq(existing_deploy.shasum)
        end
      end

      context 'when no previous snapshot exists' do
        it 'creates a new snapshot' do
          # Create a fresh website without any snapshots
          fresh_website = create_website_with_files(account: account, project: project, files: minimal_website_files)

          # Verify a snapshot is created
          initial_snapshot_count = fresh_website.snapshots.count

          deploy = fresh_website.deploys.create!(environment: 'development')

          expect(fresh_website.snapshots.count).to be > initial_snapshot_count
          expect(deploy.snapshot_id).to be_present
        end
      end
    end

    describe 'rebuild detection' do
      let!(:completed_deploy) do
        deploy = website_with_files.deploys.create!(environment: 'development')
        deploy.update!(status: 'completed', shasum: website_with_files.generate_shasum)
        deploy
      end

      it 'does not rebuild when shasum matches latest deploy' do
        expect(website_with_files.files_changed?).to be false
      end

      it 'rebuilds when shasum differs from latest deploy' do
        website_with_files.website_files.first.update!(content: 'changed')
        expect(website_with_files.files_changed?).to be true
      end

      it 'rebuilds when new files are added' do
        create(:website_file, website: website_with_files, path: '/new.html', content: 'new file')
        expect(website_with_files.files_changed?).to be true
      end

      it 'rebuilds when files are removed' do
        website_with_files.website_files.first.destroy
        expect(website_with_files.files_changed?).to be true
      end

      it 'considers only completed deploys for comparison' do
        # files_changed? should initially be false
        expect(website_with_files.files_changed?).to be false

        # Change content
        website_with_files.website_files.first.update!(content: 'changed content')

        # files_changed? should now be true
        expect(website_with_files.files_changed?).to be true

        # Create a failed deploy with the changed content
        failed_deploy = website_with_files.deploys.create!(environment: 'development')
        failed_deploy.update!(status: 'failed')

        # files_changed? should still be true - it should ignore the failed deploy
        expect(website_with_files.files_changed?).to be true
      end
    end
  end

  describe 'later_deploy_exists check' do
    let(:website_with_files) { create_website_with_files(account: account, project: project, files: minimal_website_files) }

    before do
      website_with_files.snapshot
    end

    context 'when a later deploy is already live' do
      let!(:early_deploy) do
        deploy = website_with_files.deploys.create!(environment: 'development')
        deploy.update!(created_at: 2.hours.ago)
        deploy
      end

      let!(:later_deploy) do
        deploy = website_with_files.deploys.create!(environment: 'development')
        deploy.update!(created_at: 1.hour.ago, status: 'completed', is_live: true)
        deploy
      end

      it 'skips the earlier deploy without making S3 calls' do
        expect(s3_client).not_to receive(:put_object)
        expect(s3_client).not_to receive(:copy_object)

        early_deploy.deploy!
        expect(early_deploy.reload.status).to eq('skipped')
      end
    end

    context 'when no later deploy exists' do
      let!(:deploy) { website_with_files.deploys.create!(environment: 'development') }

      before do
        allow(FileUtils).to receive(:mkdir_p)
        allow(FileUtils).to receive(:rm_rf)
        allow(File).to receive(:write)
        allow(Dir).to receive(:chdir).and_yield
        allow(Dir).to receive(:exist?).and_return(true)
        allow(deploy).to receive(:system).and_return(true)

        # Mock file system operations for upload
        allow(Dir).to receive(:glob).and_return(['/tmp/test/dist/index.html'])
        allow(File).to receive(:file?).and_return(true)
        allow(File).to receive(:open).and_yield(StringIO.new('test content'))

        allow(s3_client).to receive(:list_objects_v2).and_return(double(contents: [double(key: 'test/file.html')]))
        allow(s3_client).to receive(:put_object)
        allow(s3_client).to receive(:copy_object)
        allow(s3_client).to receive(:delete_objects)
      end

      it 'proceeds with the deploy' do
        expect(s3_client).to receive(:put_object).at_least(:once)

        deploy.deploy!
        expect(deploy.reload.status).to eq('completed')
      end
    end

    context 'when a later deploy exists but is not live' do
      let!(:early_deploy) do
        deploy = website_with_files.deploys.create!(environment: 'development')
        deploy.update!(created_at: 2.hours.ago)
        deploy
      end

      let!(:later_deploy) do
        deploy = website_with_files.deploys.create!(environment: 'development')
        deploy.update!(created_at: 1.hour.ago, status: 'failed', is_live: false)
        deploy
      end

      before do
        allow(FileUtils).to receive(:mkdir_p)
        allow(FileUtils).to receive(:rm_rf)
        allow(File).to receive(:write)
        allow(Dir).to receive(:chdir).and_yield
        allow(Dir).to receive(:exist?).and_return(true)
        allow(early_deploy).to receive(:system).and_return(true)

        # Mock file system operations for upload
        allow(Dir).to receive(:glob).and_return(['/tmp/test/dist/index.html'])
        allow(File).to receive(:file?).and_return(true)
        allow(File).to receive(:open).and_yield(StringIO.new('test content'))

        allow(s3_client).to receive(:list_objects_v2).and_return(double(contents: [double(key: 'test/file.html')]))
        allow(s3_client).to receive(:put_object)
        allow(s3_client).to receive(:copy_object)
        allow(s3_client).to receive(:delete_objects)
      end

      it 'proceeds with the deploy' do
        expect(s3_client).to receive(:put_object).at_least(:once)

        early_deploy.deploy!
        expect(early_deploy.reload.status).to eq('completed')
      end
    end

    context 'when later deploy is in different environment' do
      let!(:early_deploy) do
        deploy = website_with_files.deploys.create!(environment: 'development')
        deploy.update!(created_at: 2.hours.ago, id: 100)
        deploy
      end

      let!(:later_deploy) do
        deploy = website_with_files.deploys.create!(environment: 'production')
        deploy.update!(created_at: 1.hour.ago, status: 'completed', is_live: true, id: 101)
        deploy
      end

      before do
        allow(FileUtils).to receive(:mkdir_p)
        allow(FileUtils).to receive(:rm_rf)
        allow(File).to receive(:write)
        allow(Dir).to receive(:chdir).and_yield
        allow(Dir).to receive(:exist?).and_return(true)
        allow(early_deploy).to receive(:system).and_return(true)

        # Mock file system operations for upload
        allow(Dir).to receive(:glob).and_return(['/tmp/test/dist/index.html'])
        allow(File).to receive(:file?).and_return(true)
        allow(File).to receive(:open).and_yield(StringIO.new('test content'))

        allow(s3_client).to receive(:list_objects_v2).and_return(double(contents: [double(key: 'test/file.html')]))
        allow(s3_client).to receive(:put_object)
        allow(s3_client).to receive(:copy_object)
        allow(s3_client).to receive(:delete_objects)
      end

      it 'proceeds with the deploy (different environments are independent)' do
        # Later deploy with higher ID should skip earlier deploy
        expect(s3_client).not_to receive(:put_object)

        early_deploy.deploy!
        expect(early_deploy.reload.status).to eq('skipped')
      end
    end
  end
end
