require 'rails_helper'

RSpec.describe Atlas::WebsiteUrlService, type: :service do
  let(:service) { described_class.new }

  before do
    allow(Atlas::BaseService.config).to receive(:base_url).and_return('https://atlas.example.com')
    allow(Atlas::BaseService.config).to receive(:api_secret).and_return('test-secret')
  end

  describe '#create' do
    it 'sends correct parameters to Atlas API' do
      expect(service).to receive(:post).with(
        '/api/internal/website-urls',
        body: {
          id: 1,
          domain: 'test.com',
          path: '/campaign',
          websiteId: 123,
          domainId: 456
        }
      )

      service.create(
        id: 1,
        domain: 'test.com',
        path: '/campaign',
        website_id: 123,
        domain_id: 456
      )
    end
  end

  describe '#update' do
    it 'sends PUT request with formatted parameters' do
      expect(service).to receive(:put).with(
        '/api/internal/website-urls/1',
        body: {
          domain: 'updated.com',
          path: '/new-path',
          websiteId: 789,
          domainId: 456
        }
      )

      service.update(1, domain: 'updated.com', path: '/new-path', website_id: 789, domain_id: 456)
    end
  end

  describe '#destroy' do
    it 'sends DELETE request' do
      expect(service).to receive(:delete).with('/api/internal/website-urls/1')

      service.destroy(1)
    end
  end

  describe '#find' do
    it 'sends GET request for specific ID' do
      expect(service).to receive(:get).with('/api/internal/website-urls/1')

      service.find(1)
    end
  end

  describe '#list' do
    it 'sends GET request with optional parameters' do
      expect(service).to receive(:get).with(
        '/api/internal/website-urls',
        query: { limit: 50, websiteId: 123 }
      )

      service.list(limit: 50, website_id: 123)
    end

    it 'sends GET request without parameters' do
      expect(service).to receive(:get).with(
        '/api/internal/website-urls',
        query: {}
      )

      service.list
    end
  end

  describe '#find_by_domain_and_path' do
    it 'sends GET request to by-domain-path endpoint' do
      expect(service).to receive(:get).with(
        '/api/internal/website-urls/by-domain-path',
        query: { domain: 'test.com', path: '/campaign' }
      )

      service.find_by_domain_and_path(domain: 'test.com', path: '/campaign')
    end

    it 'defaults path to root' do
      expect(service).to receive(:get).with(
        '/api/internal/website-urls/by-domain-path',
        query: { domain: 'test.com', path: '/' }
      )

      service.find_by_domain_and_path(domain: 'test.com')
    end
  end
end
