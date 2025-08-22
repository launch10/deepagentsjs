# frozen_string_literal: true

module AtlasHelpers
  def stub_atlas_requests
    # Stub all Atlas HTTP requests to prevent actual HTTP calls
    stub_request(:any, /#{Regexp.escape(Atlas::BaseService.config.base_url)}/).to_return(
      status: 200,
      body: { success: true }.to_json,
      headers: { 'Content-Type' => 'application/json' }
    )
  end
  
  def stub_atlas_user_create(user_id: nil, plan_id: nil)
    url = "#{Atlas::BaseService.config.base_url}/api/internal/users"
    stub_request(:post, url).to_return(
      status: 201,
      body: { id: user_id || 'user-id', planId: plan_id }.to_json,
      headers: { 'Content-Type' => 'application/json' }
    )
  end
  
  def stub_atlas_website_create(website_id: nil, user_id: nil)
    url = "#{Atlas::BaseService.config.base_url}/api/internal/websites"
    stub_request(:post, url).to_return(
      status: 201,
      body: { id: website_id || 'website-id', userId: user_id || 'user-id' }.to_json,
      headers: { 'Content-Type' => 'application/json' }
    )
  end
  
  def stub_atlas_domain_create(domain_id: nil, website_id: nil, domain: nil)
    url = "#{Atlas::BaseService.config.base_url}/api/internal/domains"
    stub_request(:post, url).to_return(
      status: 201,
      body: { 
        id: domain_id || 'domain-id', 
        websiteId: website_id || 'website-id',
        domain: domain || 'example.com'
      }.to_json,
      headers: { 'Content-Type' => 'application/json' }
    )
  end
  
  def stub_atlas_not_found(path)
    url = "#{Atlas::BaseService.config.base_url}#{path}"
    stub_request(:any, url).to_return(
      status: 404,
      body: { error: 'Not found' }.to_json,
      headers: { 'Content-Type' => 'application/json' }
    )
  end
  
  def disable_atlas_sync
    allow_any_instance_of(AtlasSyncable).to receive(:atlas_sync_enabled?).and_return(false)
    
    # Also stub the Atlas service methods to prevent HTTP calls
    stub_atlas_service_methods
  end
  
  def enable_atlas_sync
    allow_any_instance_of(AtlasSyncable).to receive(:atlas_sync_enabled?).and_return(true)
  end
  
  def stub_atlas_service_methods
    # Stub all Atlas service methods to return mock responses
    mock_response = double('response', 
      id: 'mock-id',
      success: true,
      parsed_body: { success: true }
    )
    
    # Stub UserService
    allow_any_instance_of(Atlas::UserService).to receive(:create).and_return(mock_response)
    allow_any_instance_of(Atlas::UserService).to receive(:update).and_return(mock_response)
    allow_any_instance_of(Atlas::UserService).to receive(:destroy).and_return(mock_response)
    allow_any_instance_of(Atlas::UserService).to receive(:find).and_return(mock_response)
    
    # Stub WebsiteService
    allow_any_instance_of(Atlas::WebsiteService).to receive(:create).and_return(mock_response)
    allow_any_instance_of(Atlas::WebsiteService).to receive(:update).and_return(mock_response)
    allow_any_instance_of(Atlas::WebsiteService).to receive(:destroy).and_return(mock_response)
    allow_any_instance_of(Atlas::WebsiteService).to receive(:find).and_return(mock_response)
    
    # Stub DomainService
    allow_any_instance_of(Atlas::DomainService).to receive(:create).and_return(mock_response)
    allow_any_instance_of(Atlas::DomainService).to receive(:update).and_return(mock_response)
    allow_any_instance_of(Atlas::DomainService).to receive(:destroy).and_return(mock_response)
    allow_any_instance_of(Atlas::DomainService).to receive(:find).and_return(mock_response)
    
    # Stub PlanService
    allow_any_instance_of(Atlas::PlanService).to receive(:create).and_return(mock_response)
    allow_any_instance_of(Atlas::PlanService).to receive(:update).and_return(mock_response)
    allow_any_instance_of(Atlas::PlanService).to receive(:destroy).and_return(mock_response)
    allow_any_instance_of(Atlas::PlanService).to receive(:find).and_return(mock_response)
  end
end

RSpec.configure do |config|
  config.include AtlasHelpers
  
  # By default, disable Atlas sync in tests unless explicitly needed
  config.before(:each) do |example|
    # Skip atlas helpers if test explicitly manages its own mocking
    next if example.metadata[:skip_atlas_helpers]
    
    if example.metadata[:atlas_sync]
      enable_atlas_sync
      # Only stub requests if not using custom mocks
      unless example.metadata[:custom_atlas_mocks]
        stub_atlas_requests
      end
    else
      disable_atlas_sync
    end
  end
end