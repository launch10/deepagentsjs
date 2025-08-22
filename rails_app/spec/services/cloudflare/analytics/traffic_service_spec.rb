# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Cloudflare::Analytics::TrafficService do
  let(:service) { described_class.new }
  let(:zone_id) { 'test-zone-id' }
  let(:start_time) { 1.day.ago }
  let(:end_time) { Time.current }
  
  before do
    Cloudflare.configure do |config|
      config.api_token = 'test-cloudflare-token'
      config.analytics_endpoint = 'https://api.cloudflare.com/client/v4/graphql'
      config.timeout = 30
    end
    
    # Mock the HTTP response
    http_response = Net::HTTPSuccess.new('1.1', '200', 'OK')
    http_response['content-type'] = 'application/json'
    allow(http_response).to receive(:body).and_return('{"data": {"viewer": {"zones": []}}}')
    allow_any_instance_of(Net::HTTP).to receive(:request).and_return(http_response)
  end
  
  describe '#hourly_traffic_by_host' do
    it 'sends the correct GraphQL query' do
      expect(service).to receive(:execute).with(
        anything, # query
        hash_including(
          zoneTag: zone_id,
          startTime: start_time.iso8601,
          endTime: end_time.iso8601
        )
      ).and_call_original
      
      service.hourly_traffic_by_host(
        zone_id: zone_id,
        start_time: start_time,
        end_time: end_time
      )
    end
  end
  
  describe '#daily_traffic_summary' do
    it 'sends the correct GraphQL query' do
      start_date = 7.days.ago.to_date
      end_date = Date.current
      
      expect(service).to receive(:execute).with(
        anything, # query
        hash_including(
          zoneTag: zone_id,
          startTime: start_date.to_time.iso8601,
          endTime: end_date.to_time.iso8601
        )
      ).and_call_original
      
      service.daily_traffic_summary(
        zone_id: zone_id,
        start_date: start_date,
        end_date: end_date
      )
    end
  end
  
  describe '#top_paths' do
    it 'sends the correct GraphQL query with limit' do
      limit = 20
      
      expect(service).to receive(:execute).with(
        anything, # query
        hash_including(
          zoneTag: zone_id,
          startTime: start_time.iso8601,
          endTime: end_time.iso8601,
          limit: limit
        )
      ).and_call_original
      
      service.top_paths(
        zone_id: zone_id,
        start_time: start_time,
        end_time: end_time,
        limit: limit
      )
    end
    
    it 'uses default limit when not specified' do
      expect(service).to receive(:execute).with(
        anything,
        hash_including(limit: 10)
      ).and_call_original
      
      service.top_paths(
        zone_id: zone_id,
        start_time: start_time,
        end_time: end_time
      )
    end
  end
  
  describe '#bandwidth_usage' do
    it 'uses hourly query by default' do
      result = service.bandwidth_usage(
        zone_id: zone_id,
        start_time: start_time,
        end_time: end_time
      )
      
      expect(result).to be_a(ApplicationClient::Response)
    end
    
    it 'uses daily query when interval is day' do
      result = service.bandwidth_usage(
        zone_id: zone_id,
        start_time: start_time,
        end_time: end_time,
        interval: 'day'
      )
      
      expect(result).to be_a(ApplicationClient::Response)
    end
  end
  
  describe '#error_rates' do
    it 'sends the correct GraphQL query' do
      expect(service).to receive(:execute).with(
        anything, # query
        hash_including(
          zoneTag: zone_id,
          startTime: start_time.iso8601,
          endTime: end_time.iso8601
        )
      ).and_call_original
      
      service.error_rates(
        zone_id: zone_id,
        start_time: start_time,
        end_time: end_time
      )
    end
  end
end