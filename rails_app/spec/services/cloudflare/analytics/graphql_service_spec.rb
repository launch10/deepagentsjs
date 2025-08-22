# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Cloudflare::Analytics::GraphqlService do
  let(:service) { described_class.new }
  let(:api_token) { 'test-cloudflare-token' }
  let(:analytics_endpoint) { 'https://api.cloudflare.com/client/v4/graphql' }
  
  before do
    Cloudflare.configure do |config|
      config.api_token = api_token
      config.analytics_endpoint = analytics_endpoint
      config.timeout = 30
    end
  end
  
  describe '#initialize' do
    it 'uses configured api_token by default' do
      expect(service.token).to eq(api_token)
    end
    
    it 'allows overriding token on initialization' do
      custom_service = described_class.new(token: 'custom-token')
      expect(custom_service.token).to eq('custom-token')
    end
  end
  
  describe '#base_uri' do
    it 'returns analytics_endpoint from configuration' do
      expect(service.base_uri).to eq(analytics_endpoint)
    end
  end
  
  describe '#authorization_header' do
    it 'returns Bearer token header' do
      expect(service.authorization_header).to eq({ 'Authorization' => "Bearer #{api_token}" })
    end
  end
  
  describe '#content_type' do
    it 'returns application/json' do
      expect(service.content_type).to eq('application/json')
    end
  end
  
  describe '#open_timeout and #read_timeout' do
    it 'returns timeout from configuration' do
      Cloudflare.configure do |config|
        config.timeout = 60
      end
      
      expect(service.open_timeout).to eq(60)
      expect(service.read_timeout).to eq(60)
    end
  end
  
  describe '#execute' do
    let(:query) do
      <<~GRAPHQL
        query getZones {
          viewer {
            zones {
              name
            }
          }
        }
      GRAPHQL
    end
    
    let(:variables) { { zoneTag: 'test-zone' } }
    let(:stub_response) do
      response = double('response')
      allow(response).to receive(:code).and_return('200')
      allow(response).to receive(:body).and_return('{"data": {"viewer": {"zones": []}}}')
      allow(response).to receive(:each_header).and_return({})
      response
    end
    
    before do
      allow_any_instance_of(Net::HTTP).to receive(:request).and_return(stub_response)
    end
    
    it 'sends POST request with query and variables' do
      expect(service).to receive(:post).with("", body: {
        query: query,
        variables: variables
      }).and_call_original
      
      service.execute(query, variables)
    end
    
    it 'sends POST request with just query when no variables' do
      expect(service).to receive(:post).with("", body: {
        query: query,
        variables: {}
      }).and_call_original
      
      service.execute(query)
    end
  end
  
  describe '#handle_response' do
    context 'with GraphQL errors' do
      it 'raises GraphQLError when response contains errors' do
        # Create a real Net::HTTPResponse-like object
        http_response = Net::HTTPSuccess.new('1.1', '200', 'OK')
        http_response['content-type'] = 'application/json'
        allow(http_response).to receive(:body).and_return('{"data": null, "errors": [{"message": "Invalid query"}]}')
        
        # Wrap it in ApplicationClient::Response as make_request does
        response = Cloudflare::Analytics::GraphqlService::Response.new(http_response)
        
        expect {
          service.send(:handle_response, response)
        }.to raise_error(Cloudflare::Analytics::GraphqlService::GraphQLError, /Invalid query/)
      end
    end
    
    context 'without GraphQL errors' do
      it 'returns response normally' do
        # Create a real Net::HTTPResponse-like object
        http_response = Net::HTTPSuccess.new('1.1', '200', 'OK')
        http_response['content-type'] = 'application/json'
        allow(http_response).to receive(:body).and_return('{"data": {"viewer": {"zones": []}}}')
        
        # Wrap it in ApplicationClient::Response as make_request does
        response = Cloudflare::Analytics::GraphqlService::Response.new(http_response)
        
        result = service.send(:handle_response, response)
        expect(result).to be_a(ApplicationClient::Response)
        expect(result.data.viewer.zones).to eq([])
      end
    end
  end
  
  describe '#build_filter' do
    it 'builds filter with zone_id' do
      filter = service.send(:build_filter, zone_id: 'test-zone')
      expect(filter).to eq({ zoneTag: 'test-zone' })
    end
    
    it 'builds filter with time range' do
      start_time = Time.parse('2024-01-01 00:00:00')
      end_time = Time.parse('2024-01-02 00:00:00')
      
      filter = service.send(:build_filter, start_time: start_time, end_time: end_time)
      expect(filter).to include(
        datetime_geq: start_time.iso8601,
        datetime_lt: end_time.iso8601
      )
    end
    
    it 'builds complete filter' do
      start_time = Time.parse('2024-01-01 00:00:00')
      end_time = Time.parse('2024-01-02 00:00:00')
      
      filter = service.send(:build_filter, 
        zone_id: 'test-zone',
        start_time: start_time, 
        end_time: end_time
      )
      
      expect(filter).to eq({
        zoneTag: 'test-zone',
        datetime_geq: start_time.iso8601,
        datetime_lt: end_time.iso8601
      })
    end
  end
end