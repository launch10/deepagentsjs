# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Atlas::TenantService do
  let(:service) { described_class.new }
  let(:base_url) { 'http://localhost:8787' }

  before do
    Atlas::BaseService.config.base_url = base_url
    Atlas::BaseService.config.api_secret = 'test-secret'
  end

  describe '#list' do
    it 'fetches tenants list' do
      stub_request(:get, "#{base_url}/api/internal/tenants")
        .to_return(status: 200, body: [{ id: 'tenant-1' }].to_json)

      result = service.list
      expect(result).to eq([{ 'id' => 'tenant-1' }])
    end

    it 'supports limit parameter' do
      stub_request(:get, "#{base_url}/api/internal/tenants?limit=5")
        .to_return(status: 200, body: [].to_json)

      service.list(limit: 5)
    end
  end

  describe '#find' do
    it 'fetches specific tenant' do
      stub_request(:get, "#{base_url}/api/internal/tenants/tenant-123")
        .to_return(status: 200, body: { id: 'tenant-123' }.to_json)

      result = service.find('tenant-123')
      expect(result).to eq({ 'id' => 'tenant-123' })
    end
  end

  describe '#create' do
    it 'creates new tenant' do
      stub_request(:post, "#{base_url}/api/internal/tenants")
        .with(body: { id: 'tenant-new', orgId: 'org-1', planId: 'plan-1' }.to_json)
        .to_return(status: 201, body: { id: 'tenant-new' }.to_json)

      result = service.create(id: 'tenant-new', org_id: 'org-1', plan_id: 'plan-1')
      expect(result).to eq({ 'id' => 'tenant-new' })
    end
  end

  describe '#update' do
    it 'updates existing tenant' do
      stub_request(:put, "#{base_url}/api/internal/tenants/tenant-123")
        .with(body: { planId: 'plan-2' }.to_json)
        .to_return(status: 200, body: { id: 'tenant-123', planId: 'plan-2' }.to_json)

      result = service.update('tenant-123', planId: 'plan-2')
      expect(result).to eq({ 'id' => 'tenant-123', 'planId' => 'plan-2' })
    end
  end

  describe '#destroy' do
    it 'deletes tenant' do
      stub_request(:delete, "#{base_url}/api/internal/tenants/tenant-123")
        .to_return(status: 200, body: { success: true }.to_json)

      result = service.destroy('tenant-123')
      expect(result).to eq({ 'success' => true })
    end
  end
end