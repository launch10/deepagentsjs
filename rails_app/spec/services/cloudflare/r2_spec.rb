require 'rails_helper'

RSpec.describe Cloudflare::R2, type: :service do
  let(:s3_client) { instance_double(Aws::S3::Client) }
  let(:bucket_name) { 'test-bucket' }
  
  before do
    allow(Aws::S3::Client).to receive(:new).and_return(s3_client)
  end

  describe 'environment prefixing' do
    context 'when deploy_env is set' do
      before do
        allow(Cloudflare.config).to receive(:deploy_env).and_return('staging')
      end
      
      it 'prefixes keys with environment' do
        r2 = Cloudflare::R2.new(bucket_name: bucket_name)
        
        expect(s3_client).to receive(:put_object) do |args|
          expect(args[:key]).to eq('staging/project/file.txt')
        end
        
        r2.put_object(bucket: bucket_name, key: 'project/file.txt', body: 'test')
      end
      
      it 'prefixes prefix parameter with environment' do
        r2 = Cloudflare::R2.new(bucket_name: bucket_name)
        
        expect(s3_client).to receive(:list_objects_v2) do |args|
          expect(args[:prefix]).to eq('staging/project/')
        end
        
        r2.list_objects_v2(bucket: bucket_name, prefix: 'project/')
      end
      
      it 'prefixes copy_source with environment' do
        r2 = Cloudflare::R2.new(bucket_name: bucket_name)
        
        expect(s3_client).to receive(:copy_object) do |args|
          expect(args[:copy_source]).to eq('test-bucket/staging/project/source.txt')
          expect(args[:key]).to eq('staging/project/dest.txt')
        end
        
        r2.copy_object(
          bucket: bucket_name,
          copy_source: 'test-bucket/project/source.txt',
          key: 'project/dest.txt'
        )
      end
      
      it 'prefixes delete objects with environment' do
        r2 = Cloudflare::R2.new(bucket_name: bucket_name)
        
        expect(s3_client).to receive(:delete_objects) do |args|
          objects = args[:delete][:objects]
          expect(objects).to eq([
            { key: 'staging/project/file1.txt' },
            { key: 'staging/project/file2.txt' }
          ])
        end
        
        r2.delete_objects(
          bucket: bucket_name,
          delete: {
            objects: [
              { key: 'project/file1.txt' },
              { key: 'project/file2.txt' }
            ]
          }
        )
      end
      
      it 'does not double-prefix already prefixed paths' do
        r2 = Cloudflare::R2.new(bucket_name: bucket_name)
        
        expect(s3_client).to receive(:put_object) do |args|
          # Should not become staging/staging/project/file.txt
          expect(args[:key]).to eq('staging/project/file.txt')
        end
        
        r2.put_object(bucket: bucket_name, key: 'staging/project/file.txt', body: 'test')
      end
    end
    
    context 'when deploy_env is not set' do
      before do
        allow(Cloudflare.config).to receive(:deploy_env).and_return('')
      end
      
      it 'does not prefix paths' do
        r2 = Cloudflare::R2.new(bucket_name: bucket_name)
        
        expect(s3_client).to receive(:put_object) do |args|
          expect(args[:key]).to eq('project/file.txt')
        end
        
        r2.put_object(bucket: bucket_name, key: 'project/file.txt', body: 'test')
      end
    end
    
    context 'when different environments are used' do
      it 'isolates data between environments' do
        # Development environment
        allow(Cloudflare.config).to receive(:deploy_env).and_return('development')
        dev_r2 = Cloudflare::R2.new(bucket_name: bucket_name)
        
        expect(s3_client).to receive(:put_object) do |args|
          expect(args[:key]).to eq('development/project/file.txt')
        end
        dev_r2.put_object(bucket: bucket_name, key: 'project/file.txt', body: 'dev content')
        
        # Staging environment
        allow(Cloudflare.config).to receive(:deploy_env).and_return('staging')
        staging_r2 = Cloudflare::R2.new(bucket_name: bucket_name)
        
        expect(s3_client).to receive(:put_object) do |args|
          expect(args[:key]).to eq('staging/project/file.txt')
        end
        staging_r2.put_object(bucket: bucket_name, key: 'project/file.txt', body: 'staging content')
        
        # Production environment
        allow(Cloudflare.config).to receive(:deploy_env).and_return('production')
        prod_r2 = Cloudflare::R2.new(bucket_name: bucket_name)
        
        expect(s3_client).to receive(:put_object) do |args|
          expect(args[:key]).to eq('production/project/file.txt')
        end
        prod_r2.put_object(bucket: bucket_name, key: 'project/file.txt', body: 'prod content')
      end
    end
  end
end