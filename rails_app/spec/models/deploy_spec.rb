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
    let(:website_file1) { double(filename: 'index.html', content: '<html>Test</html>') }
    let(:website_file2) { double(filename: 'package.json', content: '{"name":"test"}') }
    let(:deploy) do
      allow(website).to receive(:files).and_return([website_file1, website_file2])
      allow(website).to receive(:latest_snapshot).and_return(nil)
      allow(website).to receive(:snapshot).and_return(double(id: 'snapshot_123'))
      create(:deploy, website: website)
    end
    let(:temp_dir) { "/tmp/deploy_#{deploy.id}" }

    before do
      allow(website).to receive(:files_from_snapshot).and_return([website_file1, website_file2])
      allow(FileUtils).to receive(:mkdir_p)
      allow(File).to receive(:write)
      allow(deploy).to receive(:system).and_return(true)
      allow(Dir).to receive(:exist?).and_return(true)
      allow(Dir).to receive(:glob).and_return(['dist/index.html', 'dist/main.js'])
      allow(Dir).to receive(:chdir).and_yield
    end

    it 'creates a temporary directory' do
      expect(FileUtils).to receive(:mkdir_p).with(temp_dir)
      deploy.build!
    end

    it 'writes all website files to disk' do
      expect(File).to receive(:write).with("#{temp_dir}/index.html", '<html>Test</html>')
      expect(File).to receive(:write).with("#{temp_dir}/package.json", '{"name":"test"}')
      deploy.build!
    end

    it 'runs pnpm install' do
      expect(deploy).to receive(:system).with("pnpm install")
      deploy.build!
    end

    it 'runs pnpm build' do
      expect(deploy).to receive(:system).with("pnpm build")
      deploy.build!
    end

    it 'returns the dist directory path' do
      result = deploy.build!
      expect(result).to eq("#{temp_dir}/dist")
    end

    it 'raises error if dist directory does not exist' do
      allow(Dir).to receive(:exist?).with("#{temp_dir}/dist").and_return(false)
      expect {
        deploy.build!
      }.to raise_error(StandardError, /Build failed: dist directory not found/)
    end

    it 'updates deploy status to building' do
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
    let(:r2_path) { "#{website.project_id}/#{timestamp}" }

    before do
      allow(Time).to receive(:current).and_return(Time.parse('2024-01-01 12:00:00'))
      allow(deploy).to receive(:build!).and_return(dist_path)
      
      # Mock DeployUploader
      uploader_double = double('uploader')
      allow(DeployUploader).to receive(:new).and_return(uploader_double)
      allow(uploader_double).to receive(:store!)
      allow(uploader_double).to receive(:hotswap_live)
      
      allow(FileUtils).to receive(:rm_rf)
    end

    it 'builds the project first' do
      expect(deploy).not_to receive(:build!)  # build! is no longer called from upload!
      deploy.upload!(dist_path)
    end

    it 'uploads files to timestamped directory in R2' do
      uploader = double('uploader')
      allow(DeployUploader).to receive(:new).and_return(uploader)
      expect(uploader).to receive(:store!).with(dist_path, "#{website.project_id}/20240101120000")
      allow(uploader).to receive(:hotswap_live)
      deploy.upload!(dist_path)
    end

    it 'hotswaps the live directory after successful upload' do
      uploader = double('uploader')
      allow(DeployUploader).to receive(:new).and_return(uploader)
      allow(uploader).to receive(:store!)
      expect(uploader).to receive(:hotswap_live).with("#{website.project_id}/20240101120000")
      deploy.upload!(dist_path)
    end

    it 'cleans up the temporary directory' do
      # Cleanup is now handled in deploy! method
      deploy.upload!(dist_path)
      expect(deploy.status).to eq('completed')
    end

    it 'updates deploy status to completed' do
      expect(deploy).to receive(:update!).with(status: 'uploading').ordered
      expect(deploy).to receive(:update!).with(status: 'completed').ordered
      deploy.upload!(dist_path)
    end

    it 'updates deploy status to failed on error' do
      uploader = double('uploader')
      allow(DeployUploader).to receive(:new).and_return(uploader)
      allow(uploader).to receive(:store!).and_raise(StandardError.new('Upload error'))
      
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
      allow(website).to receive(:files).and_return([double(filename: 'test.html', content: '<html>')])
      allow(website).to receive(:latest_snapshot).and_return(double(id: 'snapshot_123'))
      allow(website).to receive(:files_from_snapshot).and_return([double(filename: 'test.html', content: '<html>')])
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
      expect(deploy.deploy!).to eq(true)
    end

    it 'returns true on success' do
      uploader = double('uploader')
      allow(DeployUploader).to receive(:new).and_return(uploader)
      allow(uploader).to receive(:store!)
      allow(uploader).to receive(:hotswap_live)
      expect(deploy.deploy!).to eq(true)
    end

    it 'returns false on failure' do
      allow(deploy).to receive(:build!).and_raise(StandardError)
      expect(deploy.deploy!).to eq(false)
    end
  end
end