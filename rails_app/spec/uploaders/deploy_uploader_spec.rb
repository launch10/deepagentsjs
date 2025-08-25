require 'rails_helper'

RSpec.describe DeployUploader do
  let(:s3_client) { instance_double(Aws::S3::Client) }
  let(:uploader) { DeployUploader.new(environment: 'staging') }
  
  before do
    allow(Aws::S3::Client).to receive(:new).and_return(s3_client)
    allow(Cloudflare.config).to receive(:deploy_env).and_return('development') # Default
  end
  
  describe '#initialize' do
    it 'passes environment to Cloudflare::R2' do
      expect(Cloudflare::R2).to receive(:new).with(
        bucket_name: anything,
        environment: 'staging'
      ).and_call_original
      
      DeployUploader.new(environment: 'staging')
    end
    
    it 'uses Rails.env as default environment' do
      allow(Rails).to receive(:env).and_return('production')
      
      expect(Cloudflare::R2).to receive(:new).with(
        bucket_name: anything,
        environment: 'production'
      ).and_call_original
      
      DeployUploader.new
    end
  end
  
  describe '#store!' do
    let(:local_path) { '/tmp/test' }
    let(:remote_path) { 'project/123' }
    
    before do
      allow(Dir).to receive(:glob).and_return(['/tmp/test/index.html'])
      allow(File).to receive(:file?).and_return(true)
      allow(File).to receive(:open).and_yield(StringIO.new('test content'))
    end
    
    it 'uploads files with environment prefix via R2' do
      # The uploader was initialized with staging environment
      # So R2 should add staging/ prefix to all keys
      expect(s3_client).to receive(:put_object) do |args|
        expect(args[:key]).to eq('staging/project/123/index.html')
      end
      
      uploader.store!(local_path, remote_path)
    end
  end
  
  describe '#list_objects' do
    it 'lists objects with environment prefix via R2' do
      expect(s3_client).to receive(:list_objects_v2) do |args|
        expect(args[:prefix]).to eq('staging/project/123')
      end.and_return(double(contents: []))
      
      uploader.list_objects('project/123')
    end
  end
  
  describe '#copy_prefix' do
    it 'copies with environment prefix via R2' do
      allow(s3_client).to receive(:list_objects_v2).and_return(
        double(contents: [double(key: 'staging/source/file.txt')])
      )
      
      expect(s3_client).to receive(:copy_object) do |args|
        expect(args[:copy_source]).to eq('deploys/staging/source/file.txt')
        expect(args[:key]).to eq('staging/dest/file.txt')
      end
      
      uploader.copy_prefix('source', 'dest')
    end
  end
end