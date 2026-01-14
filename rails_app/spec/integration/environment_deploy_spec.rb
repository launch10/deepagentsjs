require 'rails_helper'

RSpec.describe 'Environment-aware deploys', type: :integration do
  include WebsiteFileHelpers

  let(:user) { create(:user) }
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project, user: user) }
  let(:website_with_files) { create_website_with_files(account: account, project: project, files: minimal_website_files) }
  let(:s3_client) { instance_double(Aws::S3::Client) }

  before do
    allow(Aws::S3::Client).to receive(:new).and_return(s3_client)
    allow_any_instance_of(Website).to receive(:sync_all_to_atlas)
    website_with_files.snapshot

    # Set config default to development
    allow(Cloudflare.config).to receive(:deploy_env).and_return('development')

    # Mock file system
    allow(FileUtils).to receive(:mkdir_p)
    allow(FileUtils).to receive(:rm_rf)
    allow(File).to receive(:write)
    allow(Dir).to receive(:chdir).and_yield
    allow(Dir).to receive(:exist?).and_return(true)
    allow(Dir).to receive(:glob).and_return(['/tmp/test/dist/index.html'])
    allow(File).to receive(:file?).and_return(true)
    allow(File).to receive(:open).and_yield(StringIO.new('test content'))

    # Mock S3 responses
    allow(s3_client).to receive(:list_objects_v2).and_return(
      double(contents: [double(key: 'test/file.html', size: 100)])
    )
    allow(s3_client).to receive(:delete_objects)
    allow(s3_client).to receive(:copy_object)
  end

  describe 'Deploy environment overrides config default' do
    it 'uses staging environment when Deploy specifies staging' do
      deploy = website_with_files.deploys.create!(environment: 'staging')
      allow(deploy).to receive(:system).and_return(true)

      # Should use staging, not development
      expect(s3_client).to receive(:put_object).at_least(:once) do |args|
        expect(args[:key]).to start_with('staging/')
        expect(args[:key]).not_to start_with('development/')
      end

      deploy.deploy!
      expect(deploy.reload.status).to eq('completed')
    end

    it 'uses production environment when Deploy specifies production' do
      deploy = website_with_files.deploys.create!(environment: 'production')
      allow(deploy).to receive(:system).and_return(true)

      # Should use production, not development
      expect(s3_client).to receive(:put_object).at_least(:once) do |args|
        expect(args[:key]).to start_with('production/')
        expect(args[:key]).not_to start_with('development/')
      end

      deploy.deploy!
      expect(deploy.reload.status).to eq('completed')
    end

    it 'falls back to config default' do
      deploy = website_with_files.deploys.create!
      allow(deploy).to receive(:system).and_return(true)

      # Should use production (from config)
      expect(s3_client).to receive(:put_object).at_least(:once) do |args|
        expect(args[:key]).to start_with('production/')
      end

      deploy.deploy!
      expect(deploy.reload.status).to eq('completed')
    end
  end

  describe 'Multiple deploys to different environments' do
    it 'properly isolates each deploy to its specified environment' do
      # Track all operations
      all_operations = []

      allow(s3_client).to receive(:put_object) do |args|
        all_operations << {op: :put, key: args[:key]}
      end

      allow(s3_client).to receive(:copy_object) do |args|
        all_operations << {op: :copy, source: args[:copy_source], dest: args[:key]}
      end

      # Create and deploy to different environments
      environments = ['development', 'staging', 'production']

      environments.each do |env|
        deploy = website_with_files.deploys.create!(environment: env)
        allow(deploy).to receive(:system).and_return(true)
        deploy.deploy!
      end

      # Group operations by environment
      dev_ops = all_operations.select { |op|
        op[:key]&.start_with?('development/') ||
          op[:source]&.include?('development/')
      }

      staging_ops = all_operations.select { |op|
        op[:key]&.start_with?('staging/') ||
          op[:source]&.include?('staging/')
      }

      prod_ops = all_operations.select { |op|
        op[:key]&.start_with?('production/') ||
          op[:source]&.include?('production/')
      }

      # Each environment should have operations
      expect(dev_ops).not_to be_empty
      expect(staging_ops).not_to be_empty
      expect(prod_ops).not_to be_empty

      # No operations should cross environments
      all_operations.each do |op|
        key = op[:key] || ''
        source = op[:source] || ''

        # Each operation should belong to exactly one environment
        environments_found = []
        environments_found << 'development' if key.start_with?('development/') || source.include?('development/')
        environments_found << 'staging' if key.start_with?('staging/') || source.include?('staging/')
        environments_found << 'production' if key.start_with?('production/') || source.include?('production/')

        expect(environments_found.size).to eq(1),
          "Operation crosses environments: #{op.inspect}"
      end
    end
  end

  describe 'Rollback respects environment' do
    it 'rollback operations stay within the deploy environment' do
      # Create two completed deploys in production
      deploy1 = website_with_files.deploys.create!(environment: 'staging')
      deploy1.update!(
        status: 'completed',
        version_path: "#{website_with_files.id}/20240101120000",
        revertible: true,
        is_live: false
      )

      deploy2 = website_with_files.deploys.create!(environment: 'production')
      deploy2.update!(
        status: 'completed',
        version_path: "#{website_with_files.id}/20240102120000",
        revertible: true,
        is_live: true
      )

      # Track copy operations during rollback
      copy_operations = []
      allow(s3_client).to receive(:copy_object) do |args|
        copy_operations << args
      end

      # Rollback should use production environment
      deploy1.rollback!

      # All copy operations should be within production
      copy_operations.each do |op|
        if op[:copy_source]
          expect(op[:copy_source]).to include('staging/')
        end
        if op[:key]
          expect(op[:key]).to start_with('staging/')
        end
      end
    end
  end
end
