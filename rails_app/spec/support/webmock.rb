require 'webmock/rspec'

# Configure WebMock to work with Typhoeus
WebMock.disable_net_connect!(allow_localhost: true)

module AtlasStubs
  def stub_atlas_requests
    # Stub all Atlas API endpoints for users
    stub_request(:post, /admin\.abeverything\.com\/api\/internal\/users/)
      .to_return(status: 200, body: { success: true }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    stub_request(:put, /admin\.abeverything\.com\/api\/internal\/users\/\d+/)
      .to_return(status: 200, body: { success: true }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    stub_request(:delete, /admin\.abeverything\.com\/api\/internal\/users\/\d+/)
      .to_return(status: 200, body: { success: true }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    stub_request(:get, /admin\.abeverything\.com\/api\/internal\/users\/\d+/)
      .to_return(status: 200, body: { id: 1, plan_id: nil }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    # Stub all Atlas API endpoints for websites
    stub_request(:post, /admin\.abeverything\.com\/api\/internal\/websites/)
      .to_return(status: 200, body: { success: true }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    stub_request(:put, /admin\.abeverything\.com\/api\/internal\/websites\/\d+/)
      .to_return(status: 200, body: { success: true }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    stub_request(:delete, /admin\.abeverything\.com\/api\/internal\/websites\/\d+/)
      .to_return(status: 200, body: { success: true }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    stub_request(:get, /admin\.abeverything\.com\/api\/internal\/websites\/\d+/)
      .to_return(status: 200, body: { id: 1, user_id: 1 }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    # Stub all Atlas API endpoints for domains
    stub_request(:post, /admin\.abeverything\.com\/api\/internal\/domains/)
      .to_return(status: 200, body: { success: true }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    stub_request(:put, /admin\.abeverything\.com\/api\/internal\/domains\/\d+/)
      .to_return(status: 200, body: { success: true }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    stub_request(:delete, /admin\.abeverything\.com\/api\/internal\/domains\/\d+/)
      .to_return(status: 200, body: { success: true }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    stub_request(:get, /admin\.abeverything\.com\/api\/internal\/domains\/\d+/)
      .to_return(status: 200, body: { id: 1, domain: 'test.com', website_id: 1 }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    # Stub all Atlas API endpoints for plans
    stub_request(:post, /admin\.abeverything\.com\/api\/internal\/plans/)
      .to_return(status: 200, body: { success: true }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    stub_request(:put, /admin\.abeverything\.com\/api\/internal\/plans\/\d+/)
      .to_return(status: 200, body: { success: true }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    stub_request(:delete, /admin\.abeverything\.com\/api\/internal\/plans\/\d+/)
      .to_return(status: 200, body: { success: true }.to_json, headers: { 'Content-Type' => 'application/json' })
    
    stub_request(:get, /admin\.abeverything\.com\/api\/internal\/plans\/\d+/)
      .to_return(status: 200, body: { id: 1, name: 'Test Plan' }.to_json, headers: { 'Content-Type' => 'application/json' })
  end
end

RSpec.configure do |config|
  config.include AtlasStubs
  
  config.before(:each) do |example|
    WebMock.reset!
    
    # Stub Atlas requests unless explicitly disabled
    unless example.metadata[:dont_stub_atlas]
      stub_atlas_requests
    end
  end
end