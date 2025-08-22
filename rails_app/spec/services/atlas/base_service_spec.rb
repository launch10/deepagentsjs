# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Atlas::BaseService do
  let(:service) { described_class.new }
  let(:api_secret) { 'test-secret' }
  let(:base_url) { 'http://localhost:8787' }

  before do
    described_class.configure do |config|
      config.api_secret = api_secret
      config.base_url = base_url
      config.timeout = 30
    end
  end

  describe '#generate_signature' do
    it 'generates correct HMAC signature' do
      body = '{"test": "data"}'
      timestamp = '1234567890'
      
      expected_signature = OpenSSL::HMAC.hexdigest(
        'SHA256',
        api_secret,
        "#{timestamp}.#{body}"
      )
      
      signature = service.send(:generate_signature, body, timestamp)
      expect(signature).to eq(expected_signature)
    end
  end

  describe '#default_headers' do
    it 'includes required headers' do
      headers = service.default_headers
      
      expect(headers).to include('X-Timestamp')
      expect(headers['Content-Type']).to eq('application/json')
      expect(headers['Accept']).to eq('application/json')
    end
  end

  describe '#make_request' do
    let(:stub_response) { double('response', code: '200', body: '{"data": "test"}') }
    
    before do
      allow_any_instance_of(Net::HTTP).to receive(:request).and_return(stub_response)
    end

    it 'adds signature to headers for POST requests' do
      expect(service).to receive(:generate_signature).and_call_original
      
      service.post('/test', body: { test: 'data' })
    end
    
    it 'adds signature to headers for GET requests' do
      expect(service).to receive(:generate_signature).with('', anything).and_call_original
      
      service.get('/test')
    end
  end

  describe '#handle_response' do
    let(:response) { double('response') }

    context 'with successful response' do
      it 'returns response for 200 status' do
        allow(response).to receive(:code).and_return('200')
        allow(response).to receive(:body).and_return('{"data": "test"}')
        
        result = service.send(:handle_response, response)
        expect(result).to eq(response)
      end

      it 'returns response for 201 status' do
        allow(response).to receive(:code).and_return('201')
        allow(response).to receive(:body).and_return('{"created": true}')
        
        result = service.send(:handle_response, response)
        expect(result).to eq(response)
      end
    end

    context 'with error responses' do
      it 'raises ValidationError for 400' do
        allow(response).to receive(:code).and_return('400')
        allow(response).to receive(:body).and_return('{"error": "Invalid data"}')
        
        expect {
          service.send(:handle_response, response)
        }.to raise_error(Atlas::BaseService::ValidationError, 'Invalid data')
      end

      it 'raises AuthenticationError for 401' do
        allow(response).to receive(:code).and_return('401')
        allow(response).to receive(:body).and_return('{"error": "Unauthorized"}')
        
        expect {
          service.send(:handle_response, response)
        }.to raise_error(Atlas::BaseService::AuthenticationError, 'Unauthorized')
      end

      it 'raises NotFoundError for 404' do
        allow(response).to receive(:code).and_return('404')
        allow(response).to receive(:body).and_return('{"error": "Not found"}')
        
        expect {
          service.send(:handle_response, response)
        }.to raise_error(Atlas::BaseService::NotFoundError, 'Not found')
      end

      it 'raises ServerError for 500' do
        allow(response).to receive(:code).and_return('500')
        allow(response).to receive(:body).and_return('{"error": "Server error"}')
        
        expect {
          service.send(:handle_response, response)
        }.to raise_error(Atlas::BaseService::ServerError, 'Server error')
      end
      
      it 'uses message field if error field is not present' do
        allow(response).to receive(:code).and_return('400')
        allow(response).to receive(:body).and_return('{"message": "Bad request"}')
        
        expect {
          service.send(:handle_response, response)
        }.to raise_error(Atlas::BaseService::ValidationError, 'Bad request')
      end
      
      it 'uses raw body if JSON parsing fails' do
        allow(response).to receive(:code).and_return('400')
        allow(response).to receive(:body).and_return('Invalid JSON')
        
        expect {
          service.send(:handle_response, response)
        }.to raise_error(Atlas::BaseService::ValidationError, 'Invalid JSON')
      end
    end
  end
  
  describe '#base_uri' do
    it 'returns base_url from configuration' do
      expect(service.base_uri).to eq(base_url)
    end
  end
  
  describe '#open_timeout and #read_timeout' do
    it 'returns timeout from configuration' do
      described_class.configure do |config|
        config.timeout = 45
      end
      
      expect(service.open_timeout).to eq(45)
      expect(service.read_timeout).to eq(45)
    end
  end
end