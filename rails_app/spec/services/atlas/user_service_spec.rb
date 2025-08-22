# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Atlas::UserService, skip_atlas_helpers: true do
  let(:service) { described_class.new }
  let(:base_url) { 'http://localhost:8787' }

  before do
    Atlas::BaseService.configure do |config|
      config.base_url = base_url
      config.api_secret = 'test-secret'
    end
    
    # Use webmock stubs instead of the general atlas helpers
    WebMock.enable!
  end
  
  after do
    WebMock.reset!
  end

  describe '#list' do
    it 'fetches users list' do
      stub_request(:get, "#{base_url}/api/internal/users")
        .to_return(
          status: 200,
          body: [{ id: 'user-1' }].to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      result = service.list
      expect(result.parsed_body.length).to eq(1)
      expect(result.parsed_body.first.id).to eq('user-1')
    end

    it 'supports limit parameter' do
      stub_request(:get, "#{base_url}/api/internal/users?limit=5")
        .to_return(
          status: 200,
          body: [].to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      result = service.list(limit: 5)
      expect(result.parsed_body).to eq([])
    end
  end

  describe '#find' do
    it 'fetches specific user' do
      stub_request(:get, "#{base_url}/api/internal/users/user-123")
        .to_return(
          status: 200,
          body: { id: 'user-123' }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      result = service.find('user-123')
      expect(result.id).to eq('user-123')
    end
  end

  describe '#create' do
    it 'creates new user' do
      stub_request(:post, "#{base_url}/api/internal/users")
        .with(body: { id: 'user-new', planId: 'plan-1' }.to_json)
        .to_return(
          status: 201,
          body: { id: 'user-new' }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )
      result = service.create(id: 'user-new', plan_id: 'plan-1')
      expect(result.id).to eq('user-new')
    end
  end

  describe '#update' do
    it 'updates existing user' do
      stub_request(:put, "#{base_url}/api/internal/users/user-123")
        .with(body: { planId: 'plan-2' }.to_json)
        .to_return(
          status: 200,
          body: { id: 'user-123', planId: 'plan-2' }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      result = service.update('user-123', planId: 'plan-2')
      expect(result.id).to eq('user-123')
      expect(result.planId).to eq('plan-2')
    end
  end

  describe '#destroy' do
    it 'deletes user' do
      stub_request(:delete, "#{base_url}/api/internal/users/user-123")
        .to_return(
          status: 200,
          body: { success: true }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      result = service.destroy('user-123')
      expect(result.success).to eq(true)
    end
  end
end