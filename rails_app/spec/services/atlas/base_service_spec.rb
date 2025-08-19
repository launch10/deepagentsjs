# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Atlas::BaseService do
  let(:service) { described_class.new }
  let(:api_secret) { 'test-secret' }
  let(:base_url) { 'http://localhost:8787' }

  before do
    Atlas::BaseService.config.api_secret = api_secret
    Atlas::BaseService.config.base_url = base_url
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

  describe '#build_headers' do
    it 'includes required headers' do
      body = '{"test": "data"}'
      headers = service.send(:build_headers, body)
      
      expect(headers).to include('X-Timestamp')
      expect(headers).to include('X-Signature')
      expect(headers['Content-Type']).to eq('application/json')
      expect(headers['Accept']).to eq('application/json')
    end

    it 'generates valid signature for timestamp' do
      body = '{"test": "data"}'
      headers = service.send(:build_headers, body)
      
      timestamp = headers['X-Timestamp']
      expected_signature = service.send(:generate_signature, body, timestamp)
      
      expect(headers['X-Signature']).to eq(expected_signature)
    end
  end

  describe '#handle_response' do
    let(:response) { double('response') }

    context 'with successful response' do
      it 'returns body for 200 status' do
        allow(response).to receive(:status).and_return(200)
        allow(response).to receive(:body).and_return({ 'data' => 'test' })
        
        result = service.send(:handle_response, response)
        expect(result).to eq({ 'data' => 'test' })
      end

      it 'returns body for 201 status' do
        allow(response).to receive(:status).and_return(201)
        allow(response).to receive(:body).and_return({ 'created' => true })
        
        result = service.send(:handle_response, response)
        expect(result).to eq({ 'created' => true })
      end
    end

    context 'with error responses' do
      it 'raises ValidationError for 400' do
        allow(response).to receive(:status).and_return(400)
        allow(response).to receive(:body).and_return({ 'error' => 'Invalid data' })
        
        expect {
          service.send(:handle_response, response)
        }.to raise_error(Atlas::BaseService::ValidationError, 'Invalid data')
      end

      it 'raises AuthenticationError for 401' do
        allow(response).to receive(:status).and_return(401)
        allow(response).to receive(:body).and_return({ 'error' => 'Unauthorized' })
        
        expect {
          service.send(:handle_response, response)
        }.to raise_error(Atlas::BaseService::AuthenticationError, 'Unauthorized')
      end

      it 'raises NotFoundError for 404' do
        allow(response).to receive(:status).and_return(404)
        allow(response).to receive(:body).and_return({ 'error' => 'Not found' })
        
        expect {
          service.send(:handle_response, response)
        }.to raise_error(Atlas::BaseService::NotFoundError, 'Not found')
      end

      it 'raises ServerError for 500' do
        allow(response).to receive(:status).and_return(500)
        allow(response).to receive(:body).and_return({ 'error' => 'Server error' })
        
        expect {
          service.send(:handle_response, response)
        }.to raise_error(Atlas::BaseService::ServerError, 'Server error')
      end
    end
  end
end