# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Atlas::AccountService, skip_atlas_helpers: true do
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
    it 'fetches accounts list' do
      stub_request(:get, "#{base_url}/api/internal/accounts")
        .to_return(
          status: 200,
          body: [{ id: 'account-1' }].to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      result = service.list
      expect(result.parsed_body.length).to eq(1)
      expect(result.parsed_body.first.id).to eq('account-1')
    end

    it 'supports limit parameter' do
      stub_request(:get, "#{base_url}/api/internal/accounts?limit=5")
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
    it 'fetches specific account' do
      stub_request(:get, "#{base_url}/api/internal/accounts/account-123")
        .to_return(
          status: 200,
          body: { id: 'account-123' }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      result = service.find('account-123')
      expect(result.id).to eq('account-123')
    end
  end

  describe '#create' do
    it 'creates new account' do
      stub_request(:post, "#{base_url}/api/internal/accounts")
        .with(body: { id: 'account-new', planId: 'plan-1' }.to_json)
        .to_return(
          status: 201,
          body: { id: 'account-new' }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )
      result = service.create(id: 'account-new', plan_id: 'plan-1')
      expect(result.id).to eq('account-new')
    end
  end

  describe '#update' do
    it 'updates existing account' do
      stub_request(:put, "#{base_url}/api/internal/accounts/account-123")
        .with(body: { planId: 'plan-2' }.to_json)
        .to_return(
          status: 200,
          body: { id: 'account-123', planId: 'plan-2' }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      result = service.update('account-123', planId: 'plan-2')
      expect(result.id).to eq('account-123')
      expect(result.planId).to eq('plan-2')
    end
  end

  describe '#destroy' do
    it 'deletes account' do
      stub_request(:delete, "#{base_url}/api/internal/accounts/account-123")
        .to_return(
          status: 200,
          body: { success: true }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      result = service.destroy('account-123')
      expect(result.success).to eq(true)
    end
  end
end