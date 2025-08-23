require 'rails_helper'

RSpec.describe Cloudflare::FirewallService do
  let(:zone_id) { 'zone_123abc' }
  let(:service) { described_class.new(zone_id) }
  let(:http_client) { instance_double(ApplicationClient) }
  
  before do
    allow(ApplicationClient).to receive(:new).and_return(http_client)
    
    # Configure Cloudflare module
    Cloudflare.configure do |config|
      config.api_token = 'test_token_123'
      config.api_email = 'test@example.com'
      config.api_key = 'test_key_456'
    end
  end
  
  describe '#initialize' do
    it 'sets the zone_id' do
      expect(service.zone_id).to eq(zone_id)
    end
    
    it 'initializes with proper base URL' do
      expect(ApplicationClient).to receive(:new).with(
        base_url: 'https://api.cloudflare.com/client/v4',
        headers: hash_including('Authorization' => 'Bearer test_token_123')
      )
      
      described_class.new(zone_id)
    end
    
    context 'with API key authentication' do
      before do
        Cloudflare.configure do |config|
          config.api_token = nil
          config.api_email = 'test@example.com'
          config.api_key = 'test_key_456'
        end
      end
      
      it 'uses X-Auth headers' do
        expect(ApplicationClient).to receive(:new).with(
          base_url: 'https://api.cloudflare.com/client/v4',
          headers: hash_including(
            'X-Auth-Email' => 'test@example.com',
            'X-Auth-Key' => 'test_key_456'
          )
        )
        
        described_class.new(zone_id)
      end
    end
  end
  
  describe '#create_rule' do
    let(:expression) { '(http.host eq "spam.example.com")' }
    let(:action) { 'block' }
    let(:description) { 'Auto-blocked: spam.example.com' }
    
    context 'when successful' do
      let(:successful_response) do
        {
          'result' => {
            'id' => 'rule_abc123',
            'expression' => expression,
            'action' => action,
            'description' => description,
            'priority' => 1,
            'enabled' => true
          },
          'success' => true,
          'errors' => [],
          'messages' => []
        }
      end
      
      before do
        allow(http_client).to receive(:post).and_return(successful_response)
      end
      
      it 'sends POST request to create firewall rule' do
        expect(http_client).to receive(:post).with(
          "/zones/#{zone_id}/firewall/rules",
          [
            {
              expression: expression,
              action: action,
              description: description,
              priority: 1,
              enabled: true
            }
          ]
        )
        
        service.create_rule(expression: expression, action: action, description: description)
      end
      
      it 'returns the API response' do
        result = service.create_rule(expression: expression, action: action, description: description)
        expect(result).to eq(successful_response)
      end
      
      it 'allows custom priority' do
        expect(http_client).to receive(:post).with(
          anything,
          array_including(hash_including(priority: 100))
        )
        
        service.create_rule(expression: expression, action: action, description: description, priority: 100)
      end
      
      it 'allows disabling rule on creation' do
        expect(http_client).to receive(:post).with(
          anything,
          array_including(hash_including(enabled: false))
        )
        
        service.create_rule(expression: expression, action: action, description: description, enabled: false)
      end
    end
    
    context 'when API returns error' do
      let(:error_response) do
        {
          'result' => nil,
          'success' => false,
          'errors' => [
            { 'code' => 10014, 'message' => 'Rate limit exceeded' }
          ],
          'messages' => []
        }
      end
      
      before do
        allow(http_client).to receive(:post).and_return(error_response)
      end
      
      it 'returns the error response' do
        result = service.create_rule(expression: expression, action: action, description: description)
        expect(result).to eq(error_response)
      end
    end
    
    context 'when API raises exception' do
      before do
        allow(http_client).to receive(:post).and_raise(ApplicationClient::Error.new('Connection timeout'))
      end
      
      it 'raises ApiError' do
        expect {
          service.create_rule(expression: expression, action: action, description: description)
        }.to raise_error(Cloudflare::FirewallService::ApiError, 'Connection timeout')
      end
    end
  end
  
  describe '#delete_rule' do
    let(:rule_id) { 'rule_abc123' }
    
    context 'when successful' do
      let(:successful_response) do
        {
          'result' => { 'id' => rule_id },
          'success' => true,
          'errors' => [],
          'messages' => []
        }
      end
      
      before do
        allow(http_client).to receive(:delete).and_return(successful_response)
      end
      
      it 'sends DELETE request to remove firewall rule' do
        expect(http_client).to receive(:delete).with("/zones/#{zone_id}/firewall/rules/#{rule_id}")
        service.delete_rule(rule_id)
      end
      
      it 'returns the API response' do
        result = service.delete_rule(rule_id)
        expect(result).to eq(successful_response)
      end
    end
    
    context 'when rule not found' do
      let(:not_found_response) do
        {
          'result' => nil,
          'success' => false,
          'errors' => [
            { 'code' => 10008, 'message' => 'Firewall rule not found' }
          ],
          'messages' => []
        }
      end
      
      before do
        allow(http_client).to receive(:delete).and_return(not_found_response)
      end
      
      it 'returns the error response' do
        result = service.delete_rule(rule_id)
        expect(result).to eq(not_found_response)
      end
    end
    
    context 'when API raises exception' do
      before do
        allow(http_client).to receive(:delete).and_raise(ApplicationClient::Unauthorized.new('Invalid authentication'))
      end
      
      it 'raises ApiError' do
        expect {
          service.delete_rule(rule_id)
        }.to raise_error(Cloudflare::FirewallService::ApiError, 'Invalid authentication')
      end
    end
  end
  
  describe '#list_rules' do
    context 'when successful' do
      let(:successful_response) do
        {
          'result' => [
            {
              'id' => 'rule_1',
              'expression' => '(http.host eq "spam1.com")',
              'action' => 'block',
              'description' => 'Block spam1',
              'priority' => 1,
              'enabled' => true
            },
            {
              'id' => 'rule_2',
              'expression' => '(http.host eq "spam2.com")',
              'action' => 'block',
              'description' => 'Block spam2',
              'priority' => 2,
              'enabled' => true
            }
          ],
          'success' => true,
          'result_info' => {
            'page' => 1,
            'per_page' => 100,
            'total_pages' => 1,
            'count' => 2,
            'total_count' => 2
          }
        }
      end
      
      before do
        allow(http_client).to receive(:get).and_return(successful_response)
      end
      
      it 'sends GET request to list firewall rules' do
        expect(http_client).to receive(:get).with(
          "/zones/#{zone_id}/firewall/rules",
          params: { page: 1, per_page: 100 }
        )
        
        service.list_rules
      end
      
      it 'returns array of rules' do
        result = service.list_rules
        expect(result).to eq(successful_response['result'])
      end
      
      it 'supports pagination parameters' do
        expect(http_client).to receive(:get).with(
          anything,
          params: { page: 2, per_page: 50 }
        )
        
        service.list_rules(page: 2, per_page: 50)
      end
      
      it 'supports filtering by action' do
        expect(http_client).to receive(:get).with(
          anything,
          params: hash_including(action: 'block')
        )
        
        service.list_rules(action: 'block')
      end
    end
    
    context 'with pagination' do
      let(:page1_response) do
        {
          'result' => [{ 'id' => 'rule_1' }],
          'success' => true,
          'result_info' => { 'total_pages' => 2 }
        }
      end
      
      let(:page2_response) do
        {
          'result' => [{ 'id' => 'rule_2' }],
          'success' => true,
          'result_info' => { 'total_pages' => 2 }
        }
      end
      
      it 'fetches all pages when fetch_all is true' do
        allow(http_client).to receive(:get)
          .with(anything, params: hash_including(page: 1))
          .and_return(page1_response)
        
        allow(http_client).to receive(:get)
          .with(anything, params: hash_including(page: 2))
          .and_return(page2_response)
        
        result = service.list_rules(fetch_all: true)
        expect(result).to eq([{ 'id' => 'rule_1' }, { 'id' => 'rule_2' }])
      end
    end
  end
  
  describe '#get_rule' do
    let(:rule_id) { 'rule_abc123' }
    
    context 'when successful' do
      let(:successful_response) do
        {
          'result' => {
            'id' => rule_id,
            'expression' => '(http.host eq "spam.com")',
            'action' => 'block',
            'description' => 'Block spam',
            'priority' => 1,
            'enabled' => true
          },
          'success' => true
        }
      end
      
      before do
        allow(http_client).to receive(:get).and_return(successful_response)
      end
      
      it 'sends GET request for specific rule' do
        expect(http_client).to receive(:get).with("/zones/#{zone_id}/firewall/rules/#{rule_id}")
        service.get_rule(rule_id)
      end
      
      it 'returns the rule data' do
        result = service.get_rule(rule_id)
        expect(result).to eq(successful_response['result'])
      end
    end
  end
  
  describe '#update_rule' do
    let(:rule_id) { 'rule_abc123' }
    let(:updates) do
      {
        expression: '(http.host eq "newspam.com")',
        description: 'Updated description',
        enabled: false
      }
    end
    
    context 'when successful' do
      let(:successful_response) do
        {
          'result' => {
            'id' => rule_id,
            'expression' => updates[:expression],
            'action' => 'block',
            'description' => updates[:description],
            'enabled' => updates[:enabled]
          },
          'success' => true
        }
      end
      
      before do
        allow(http_client).to receive(:patch).and_return(successful_response)
      end
      
      it 'sends PATCH request to update rule' do
        expect(http_client).to receive(:patch).with(
          "/zones/#{zone_id}/firewall/rules/#{rule_id}",
          updates
        )
        
        service.update_rule(rule_id, updates)
      end
      
      it 'returns the updated rule' do
        result = service.update_rule(rule_id, updates)
        expect(result).to eq(successful_response)
      end
    end
  end
  
  describe '#bulk_delete_rules' do
    let(:rule_ids) { ['rule_1', 'rule_2', 'rule_3'] }
    
    context 'when successful' do
      let(:successful_response) do
        {
          'result' => rule_ids.map { |id| { 'id' => id } },
          'success' => true
        }
      end
      
      before do
        allow(http_client).to receive(:delete).and_return(successful_response)
      end
      
      it 'sends DELETE request with multiple rule IDs' do
        expect(http_client).to receive(:delete).with(
          "/zones/#{zone_id}/firewall/rules",
          params: { id: rule_ids.join(',') }
        )
        
        service.bulk_delete_rules(rule_ids)
      end
      
      it 'returns the API response' do
        result = service.bulk_delete_rules(rule_ids)
        expect(result).to eq(successful_response)
      end
    end
    
    context 'with empty array' do
      it 'returns empty success response without API call' do
        expect(http_client).not_to receive(:delete)
        
        result = service.bulk_delete_rules([])
        expect(result).to eq({ 'result' => [], 'success' => true })
      end
    end
  end
  
  describe '#validate_expression' do
    let(:expression) { '(http.host eq "test.com")' }
    
    context 'when expression is valid' do
      let(:successful_response) do
        {
          'result' => {
            'expression' => expression,
            'valid' => true
          },
          'success' => true
        }
      end
      
      before do
        allow(http_client).to receive(:post).and_return(successful_response)
      end
      
      it 'sends POST request to validate expression' do
        expect(http_client).to receive(:post).with(
          "/zones/#{zone_id}/firewall/rules/validate",
          { expression: expression }
        )
        
        service.validate_expression(expression)
      end
      
      it 'returns true for valid expression' do
        result = service.validate_expression(expression)
        expect(result).to be true
      end
    end
    
    context 'when expression is invalid' do
      let(:error_response) do
        {
          'result' => {
            'expression' => expression,
            'valid' => false,
            'errors' => ['Invalid syntax near "eq"']
          },
          'success' => true
        }
      end
      
      before do
        allow(http_client).to receive(:post).and_return(error_response)
      end
      
      it 'returns false for invalid expression' do
        result = service.validate_expression(expression)
        expect(result).to be false
      end
    end
  end
  
  describe 'error handling' do
    describe described_class::ApiError do
      it 'is a StandardError' do
        expect(described_class::ApiError.new('test')).to be_a(StandardError)
      end
    end
    
    context 'when rate limited' do
      let(:rate_limit_response) do
        {
          'success' => false,
          'errors' => [
            { 'code' => 10014, 'message' => 'Rate limit exceeded' }
          ]
        }
      end
      
      before do
        allow(http_client).to receive(:post).and_return(rate_limit_response)
      end
      
      it 'includes rate limit information in response' do
        result = service.create_rule(expression: 'test', action: 'block')
        expect(result['errors'].first['code']).to eq(10014)
      end
    end
  end
end