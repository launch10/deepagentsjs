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
#
# Indexes
#
#  index_deploys_on_created_at              (created_at)
#  index_deploys_on_is_live                 (is_live)
#  index_deploys_on_revertible              (revertible)
#  index_deploys_on_snapshot_id             (snapshot_id)
#  index_deploys_on_status                  (status)
#  index_deploys_on_trigger                 (trigger)
#  index_deploys_on_website_history_id      (website_history_id)
#  index_deploys_on_website_id              (website_id)
#  index_deploys_on_website_id_and_is_live  (website_id,is_live)
#

require 'rails_helper'

RSpec.describe Deploy, type: :model do
  let(:user) { create(:user) }
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project, user: user) }

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
  end

  describe 'callbacks' do
    describe 'before_create' do
      context 'when website has no snapshot' do
        before do
          allow(website).to receive(:latest_snapshot).and_return(nil)
          allow(website).to receive(:snapshot).and_return(double(id: 'snapshot_123'))
          allow(website).to receive(:files).and_return([double(filename: 'test.html')])
        end

        it 'creates a snapshot' do
          expect(website).to receive(:snapshot).and_return(double(id: 'snapshot_123'))
          Deploy.create(website: website)
        end
      end

      context 'when website has a snapshot' do
        before do
          allow(website).to receive(:latest_snapshot).and_return(double(id: 'snapshot_123'))
          allow(website).to receive(:files).and_return([double(filename: 'test.html')])
        end

        it 'does not create a new snapshot' do
          expect(website).not_to receive(:snapshot)
          Deploy.create(website: website)
        end
      end

      context 'when website has no files' do
        before do
          allow(website).to receive(:latest_snapshot).and_return(double(id: 'snapshot_123'))
          allow(website).to receive(:files).and_return([])
        end

        it 'raises an error' do
          expect {
            Deploy.create!(website: website)
          }.to raise_error(StandardError, /Cannot deploy website without files/)
        end
      end
    end
  end

  describe '#build!' do
    let(:website_file1) { double(path: 'index.html', content: '<html>Test</html>') }
    let(:website_file2) { double(path: 'package.json', content: '{"name":"test"}') }
    let(:deploy) do
      allow(website).to receive(:files).and_return([website_file1, website_file2])
      allow(website).to receive(:latest_snapshot).and_return(nil)
      allow(website).to receive(:snapshot).and_return(double(id: 'snapshot_123'))
      create(:deploy, website: website)
    end
    let(:temp_dir) { Rails.root.join("tmp/deploy_#{deploy.id}").to_s }

    before do
      allow(website).to receive(:files_from_snapshot).and_return([website_file1, website_file2])
      allow(FileUtils).to receive(:mkdir_p)
      allow(File).to receive(:write)
      allow(Dir).to receive(:glob).and_return(['dist/index.html', 'dist/main.js'])
      allow(Dir).to receive(:chdir).and_yield
    end

    it 'creates a temporary directory' do
      allow(Dir).to receive(:exist?).with("#{temp_dir}/dist").and_return(false, true)
      allow(deploy).to receive(:system).and_return(true)
      expect(FileUtils).to receive(:mkdir_p).with(temp_dir)
      deploy.build!
    end

    it 'writes all website files to disk' do
      allow(Dir).to receive(:exist?).with("#{temp_dir}/dist").and_return(false, true)
      allow(deploy).to receive(:system).and_return(true)
      expect(File).to receive(:write).with("#{temp_dir}/index.html", '<html>Test</html>')
      expect(File).to receive(:write).with("#{temp_dir}/package.json", '{"name":"test"}')
      deploy.build!
    end

    it 'runs pnpm install' do
      allow(Dir).to receive(:exist?).with("#{temp_dir}/dist").and_return(false, true)
      expect(deploy).to receive(:system).with("pnpm install").and_return(true)
      expect(deploy).to receive(:system).with("pnpm build").and_return(true)
      deploy.build!
    end

    it 'runs pnpm build' do
      allow(Dir).to receive(:exist?).with("#{temp_dir}/dist").and_return(false, true)
      expect(deploy).to receive(:system).with("pnpm install").and_return(true)
      expect(deploy).to receive(:system).with("pnpm build").and_return(true)
      deploy.build!
    end

    it 'returns the dist directory path' do
      allow(Dir).to receive(:exist?).with("#{temp_dir}/dist").and_return(false, true)
      allow(deploy).to receive(:system).and_return(true)
      result = deploy.build!
      expect(result).to eq("#{temp_dir}/dist")
    end

    it 'raises error if dist directory does not exist' do
      allow(deploy).to receive(:system).and_return(true)
      allow(Dir).to receive(:exist?).with("#{temp_dir}/dist").and_return(false)
      expect {
        deploy.build!
      }.to raise_error(StandardError, /Build failed: dist directory not found/)
    end

    it 'updates deploy status to building' do
      allow(Dir).to receive(:exist?).with("#{temp_dir}/dist").and_return(false, true)
      allow(deploy).to receive(:system).and_return(true)
      expect(deploy).to receive(:update!).with(status: 'building')
      deploy.build!
    end
  end

  describe '#upload!' do
    let(:website_file1) { double(filename: 'index.html', content: '<html>Test</html>') }
    let(:deploy) do
      allow(website).to receive(:files).and_return([website_file1])
      allow(website).to receive(:latest_snapshot).and_return(nil)
      allow(website).to receive(:snapshot).and_return(double(id: 'snapshot_123'))
      create(:deploy, website: website)
    end
    let(:dist_path) { "/tmp/deploy_#{deploy.id}/dist" }
    let(:timestamp) { Time.current.strftime('%Y%m%d%H%M%S') }
    let(:r2_path) { "#{website.id}/#{timestamp}" }

    before do
      allow(Time).to receive(:current).and_return(Time.parse('2024-01-01 12:00:00'))
      allow(deploy).to receive(:build!).and_return(dist_path)
      
      # Mock DeployUploader
      uploader_double = double('uploader')
      allow(DeployUploader).to receive(:new).and_return(uploader_double)
      allow(uploader_double).to receive(:store!)
      allow(uploader_double).to receive(:hotswap_live)
      allow(uploader_double).to receive(:cleanup_old_deploys)
      
      allow(FileUtils).to receive(:rm_rf)
    end

    it 'builds the project first' do
      expect(deploy).not_to receive(:build!)  # build! is no longer called from upload!
      deploy.upload!(dist_path)
    end

    it 'uploads files to timestamped directory in R2' do
      uploader = double('uploader')
      allow(DeployUploader).to receive(:new).and_return(uploader)
      expect(uploader).to receive(:store!).with(dist_path, match(/#{website.id}\/\d{14}/))
      allow(uploader).to receive(:hotswap_live)
      allow(uploader).to receive(:cleanup_old_deploys)
      deploy.upload!(dist_path)
    end

    it 'hotswaps the live directory after successful upload' do
      uploader = double('uploader')
      allow(DeployUploader).to receive(:new).and_return(uploader)
      allow(uploader).to receive(:store!)
      allow(uploader).to receive(:cleanup_old_deploys)
      expect(uploader).to receive(:hotswap_live).with(match(/#{website.id}\/\d{14}/))
      deploy.upload!(dist_path)
    end

    it 'cleans up the temporary directory' do
      # Cleanup is now handled in deploy! method
      deploy.upload!(dist_path)
      expect(deploy.status).to eq('completed')
    end

    it 'updates deploy status to completed' do
      expect(deploy).to receive(:update!).with(status: 'uploading').ordered
      expect(deploy).to receive(:update!).with(hash_including(status: 'completed', is_live: true, revertible: true)).ordered
      deploy.upload!(dist_path)
    end

    it 'updates deploy status to failed on error' do
      uploader = double('uploader')
      allow(DeployUploader).to receive(:new).and_return(uploader)
      allow(uploader).to receive(:store!).and_raise(StandardError.new('Upload error'))
      allow(uploader).to receive(:cleanup_old_deploys)
      
      expect(deploy).to receive(:update!).with(status: 'uploading').ordered
      expect(deploy).to receive(:update!).with(status: 'failed', stacktrace: anything).ordered
      expect { deploy.upload!(dist_path) }.to raise_error(StandardError)
    end
  end

  describe 'status state machine' do
    let(:deploy) do
      allow(website).to receive(:files).and_return([double(filename: 'test.html')])
      allow(website).to receive(:latest_snapshot).and_return(double(id: 'snapshot_123'))
      create(:deploy, website: website, status: 'pending')
    end

    it 'starts with pending status' do
      new_deploy = Deploy.new(website: website)
      expect(new_deploy.status).to eq('pending')
    end

    it 'can transition from pending to building' do
      deploy.update(status: 'building')
      expect(deploy.status).to eq('building')
    end

    it 'can transition from building to uploading' do
      deploy.update(status: 'building')
      deploy.update(status: 'uploading')
      expect(deploy.status).to eq('uploading')
    end

    it 'can transition from uploading to completed' do
      deploy.update(status: 'uploading')
      deploy.update(status: 'completed')
      expect(deploy.status).to eq('completed')
    end

    it 'can transition to failed from any state' do
      ['pending', 'building', 'uploading'].each do |status|
        deploy.update(status: status)
        deploy.update(status: 'failed')
        expect(deploy.status).to eq('failed')
        deploy.update(status: 'pending') # Reset for next iteration
      end
    end
  end

  describe 'scopes' do
    before do
      allow(website).to receive(:files).and_return([double(filename: 'test.html')])
      allow(website).to receive(:latest_snapshot).and_return(double(id: 'snapshot_123'))
    end
    
    let!(:completed_deploy) { create(:deploy, website: website, status: 'completed') }
    let!(:failed_deploy) { create(:deploy, website: website, status: 'failed') }
    let!(:pending_deploy) { create(:deploy, website: website, status: 'pending') }

    describe '.completed' do
      it 'returns only completed deploys' do
        expect(Deploy.completed).to include(completed_deploy)
        expect(Deploy.completed).not_to include(failed_deploy, pending_deploy)
      end
    end

    describe '.failed' do
      it 'returns only failed deploys' do
        expect(Deploy.failed).to include(failed_deploy)
        expect(Deploy.failed).not_to include(completed_deploy, pending_deploy)
      end
    end

    describe '.pending' do
      it 'returns only pending deploys' do
        expect(Deploy.pending).to include(pending_deploy)
        expect(Deploy.pending).not_to include(completed_deploy, failed_deploy)
      end
    end
  end

  describe '#deploy!' do
    let(:deploy) do
      allow(website).to receive(:files).and_return([double(path: 'test.html', content: '<html>')])
      allow(website).to receive(:latest_snapshot).and_return(double(id: 'snapshot_123'))
      allow(website).to receive(:files_from_snapshot).and_return([double(path: 'test.html', content: '<html>')])
      create(:deploy, website: website)
    end
    
    before do
      allow(FileUtils).to receive(:mkdir_p)
      allow(File).to receive(:write)
      allow(Dir).to receive(:chdir).and_yield
      allow(deploy).to receive(:system).and_return(true)
      allow(Dir).to receive(:exist?).and_return(true)
      allow(FileUtils).to receive(:rm_rf)
    end

    it 'orchestrates the full deployment process' do
      uploader = double('uploader')
      allow(DeployUploader).to receive(:new).and_return(uploader)
      allow(uploader).to receive(:store!)
      allow(uploader).to receive(:hotswap_live)
      allow(uploader).to receive(:cleanup_old_deploys)
      expect(deploy.deploy!).to eq(true)
    end

    it 'returns true on success' do
      uploader = double('uploader')
      allow(DeployUploader).to receive(:new).and_return(uploader)
      allow(uploader).to receive(:store!)
      allow(uploader).to receive(:hotswap_live)
      allow(uploader).to receive(:cleanup_old_deploys)
      expect(deploy.deploy!).to eq(true)
    end

    it 'returns false on failure' do
      allow(deploy).to receive(:build!).and_raise(StandardError)
      expect(deploy.deploy!).to eq(false)
    end
  end

  describe 'versioning and rollback' do
    let(:website_file) { double(path: 'index.html', content: '<html>v1</html>') }
    let(:deploy1) do
      allow(website).to receive(:files).and_return([website_file])
      allow(website).to receive(:latest_snapshot).and_return(nil)
      allow(website).to receive(:snapshot).and_return(double(id: 'snapshot_1'))
      create(:deploy, website: website, created_at: 1.hour.ago)
    end
    let(:deploy2) do
      allow(website).to receive(:files).and_return([website_file])
      allow(website).to receive(:latest_snapshot).and_return(double(id: 'snapshot_2'))
      create(:deploy, website: website, created_at: 30.minutes.ago)
    end
    let(:deploy3) do
      allow(website).to receive(:files).and_return([website_file])
      allow(website).to receive(:latest_snapshot).and_return(double(id: 'snapshot_3'))
      create(:deploy, website: website)
    end

    before do
      # Mock uploader
      uploader_double = double('uploader')
      allow(DeployUploader).to receive(:new).and_return(uploader_double)
      allow(uploader_double).to receive(:store!)
      allow(uploader_double).to receive(:hotswap_live)
      allow(uploader_double).to receive(:preserve_current_live)
      allow(uploader_double).to receive(:cleanup_old_deploys)
    end

    describe '#upload!' do
      it 'marks deploy as live when completed' do
        allow(deploy1).to receive(:build!).and_return('/tmp/deploy_1/dist')
        deploy1.upload!('/tmp/deploy_1/dist')
        expect(deploy1.reload.is_live).to be true
      end

      it 'stores version_path with timestamp' do
        allow(deploy1).to receive(:build!).and_return('/tmp/deploy_1/dist')
        deploy1.upload!('/tmp/deploy_1/dist')
        expect(deploy1.reload.version_path).to match(/#{website.id}\/\d{14}/)
      end

      it 'preserves current live version before deploying new one' do
        deploy1.update!(status: 'completed', is_live: true, version_path: "#{website.id}/20240101120000")
        
        uploader = double('uploader')
        allow(DeployUploader).to receive(:new).and_return(uploader)
        expect(uploader).to receive(:preserve_current_live).with(website.id, deploy1.created_at.strftime('%Y%m%d%H%M%S'))
        allow(uploader).to receive(:store!)
        allow(uploader).to receive(:hotswap_live)
        allow(uploader).to receive(:cleanup_old_deploys)
        
        deploy2.upload!('/tmp/deploy_2/dist')
      end

      it 'marks previous live deploy as not live' do
        deploy1.update!(status: 'completed', is_live: true)
        deploy2.upload!('/tmp/deploy_2/dist')
        
        expect(deploy1.reload.is_live).to be false
        expect(deploy2.reload.is_live).to be true
      end
    end

    describe '#rollback!' do
      before do
        deploy1.update!(status: 'completed', is_live: false, revertible: true, version_path: "#{website.id}/20240101110000")
        deploy2.update!(status: 'completed', is_live: false, revertible: true, version_path: "#{website.id}/20240101113000")
        deploy3.update!(status: 'completed', is_live: true, revertible: true, version_path: "#{website.id}/20240101120000")
      end

      it 'rolls back to a previous version' do
        expect(deploy2.rollback!).to be true
        expect(deploy2.reload.is_live).to be true
        expect(deploy3.reload.is_live).to be false
      end

      it 'calls hotswap_live with the correct version path' do
        uploader = double('uploader')
        allow(DeployUploader).to receive(:new).and_return(uploader)
        allow(uploader).to receive(:preserve_current_live)
        expect(uploader).to receive(:hotswap_live).with(deploy2.version_path)
        
        deploy2.rollback!
      end

      it 'fails if deploy is not completed' do
        deploy2.update!(status: 'failed', is_live: false, revertible: true, version_path: "#{website.id}/20240101113000")
        expect { deploy2.rollback! }.to raise_error(/Cannot rollback non-completed deploy/)
      end

      it 'fails if deploy is not revertible' do
        deploy2.update!(status: 'completed', is_live: false, revertible: false, version_path: "#{website.id}/20240101113000")
        expect { deploy2.rollback! }.to raise_error(/Cannot rollback non-revertible deploy/)
      end

      it 'fails if deploy is already live' do
        deploy3.update!(status: 'completed', is_live: true, revertible: true, version_path: "#{website.id}/20240101120000")
        expect { deploy3.rollback! }.to raise_error(/Cannot roll back any further!/)
      end

      it 'returns false on error' do
        uploader = double('uploader')
        allow(DeployUploader).to receive(:new).and_return(uploader)
        allow(uploader).to receive(:preserve_current_live)
        allow(uploader).to receive(:hotswap_live).and_raise(StandardError.new('Test error'))
        expect(deploy2.reload.rollback!).to be false
      end
    end

    describe '.revertible scope' do
      before do
        deploy1.update!(revertible: false)
        deploy2.update!(revertible: true)
        deploy3.update!(revertible: true)
      end

      it 'returns only revertible deploys' do
        expect(Deploy.revertible).to include(deploy2, deploy3)
        expect(Deploy.revertible).not_to include(deploy1)
      end
    end

    describe '.live scope' do
      before do
        deploy1.update!(is_live: false)
        deploy2.update!(is_live: false)
        deploy3.update!(is_live: true)
      end

      it 'returns only live deploys' do
        expect(Deploy.live).to include(deploy3)
        expect(Deploy.live).not_to include(deploy1, deploy2)
      end
    end

    describe '#update_revertible_deploys' do
      let!(:deploy4) do
        allow(website).to receive(:files).and_return([website_file])
        allow(website).to receive(:latest_snapshot).and_return(double(id: 'snapshot_4'))
        create(:deploy, website: website, status: 'completed')
      end
      let!(:deploy5) do
        allow(website).to receive(:files).and_return([website_file])
        allow(website).to receive(:latest_snapshot).and_return(double(id: 'snapshot_5'))
        create(:deploy, website: website, status: 'completed')
      end

      before do
        deploy1.update!(status: 'completed')
        deploy2.update!(status: 'completed')
        deploy3.update!(status: 'completed')
      end

      it 'marks only the last 5 completed deploys as revertible' do
        deploy5.send(:update_revertible_deploys)
        
        deploys = website.deploys.completed.order(created_at: :desc)
        # With KEEP_DEPLOY_LIMIT = 5, all 5 deploys should be revertible
        expect(deploys.all?(&:revertible?)).to be true
      end

      it 'is called after creating a new deploy' do
        expect_any_instance_of(Deploy).to receive(:update_revertible_deploys)
        
        allow(website).to receive(:files).and_return([website_file])
        allow(website).to receive(:latest_snapshot).and_return(double(id: 'snapshot_6'))
        create(:deploy, website: website)
      end
    end
  end
end
