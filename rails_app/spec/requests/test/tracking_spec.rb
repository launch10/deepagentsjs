require 'rails_helper'

RSpec.describe "Test Tracking API", type: :request do
  before do
    allow(Rails.env).to receive(:local?).and_return(true)
  end

  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:template) { Template.first || create(:template) }
  let(:website) { create(:website, account: account, project: project, template: template) }

  describe 'GET /test/tracking/stats' do
    context 'with valid website_id' do
      it 'returns tracking stats' do
        # Create some visits and events
        visit = Ahoy::Visit.create!(
          website: website,
          visitor_token: SecureRandom.uuid,
          visit_token: SecureRandom.uuid,
          started_at: Time.current
        )

        Ahoy::Event.create!(
          visit: visit,
          name: "page_view",
          properties: { path: "/" },
          time: Time.current
        )

        get "/test/tracking/stats", params: { website_id: website.id }

        expect(response).to have_http_status(:ok)
        data = JSON.parse(response.body)

        expect(data['visit_count']).to eq(1)
        expect(data['visitor_tokens'].length).to eq(1)
        expect(data['events'].length).to eq(1)
        expect(data['events'].first['name']).to eq('page_view')
      end

      it 'returns empty stats when no visits exist' do
        get "/test/tracking/stats", params: { website_id: website.id }

        expect(response).to have_http_status(:ok)
        data = JSON.parse(response.body)

        expect(data['visit_count']).to eq(0)
        expect(data['visitor_tokens']).to eq([])
        expect(data['events']).to eq([])
      end
    end

    context 'with invalid website_id' do
      it 'returns 404' do
        get "/test/tracking/stats", params: { website_id: 99999 }

        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe 'GET /test/tracking/leads' do
    context 'with valid website_id' do
      it 'returns leads and conversion data' do
        # Create a visit, lead, and conversion event
        visit = Ahoy::Visit.create!(
          website: website,
          visitor_token: SecureRandom.uuid,
          visit_token: SecureRandom.uuid,
          started_at: Time.current
        )

        lead = create(:lead, account: account, email: 'test-lead@example.com')
        create(:website_lead, lead: lead, website: website, visit: visit, gclid: 'test-gclid')

        Ahoy::Event.create!(
          visit: visit,
          name: "conversion",
          properties: { email: 'test-lead@example.com', value: 50.0, currency: 'USD' },
          time: Time.current
        )

        get "/test/tracking/leads", params: { website_id: website.id }

        expect(response).to have_http_status(:ok)
        data = JSON.parse(response.body)

        expect(data['lead_count']).to eq(1)
        expect(data['leads'].first['email']).to eq('test-lead@example.com')
        expect(data['leads'].first['gclid']).to eq('test-gclid')
        expect(data['conversions'].length).to eq(1)
        expect(data['conversions'].first['value']).to eq(50.0)
        expect(data['conversions'].first['currency']).to eq('USD')
      end

      it 'returns empty data when no leads exist' do
        get "/test/tracking/leads", params: { website_id: website.id }

        expect(response).to have_http_status(:ok)
        data = JSON.parse(response.body)

        expect(data['lead_count']).to eq(0)
        expect(data['leads']).to eq([])
        expect(data['conversions']).to eq([])
      end
    end
  end

  describe 'non-local environment' do
    before do
      allow(Rails.env).to receive(:local?).and_return(false)
    end

    it 'redirects stats endpoint to root' do
      get "/test/tracking/stats", params: { website_id: website.id }

      expect(response).to redirect_to(root_path)
    end

    it 'redirects leads endpoint to root' do
      get "/test/tracking/leads", params: { website_id: website.id }

      expect(response).to redirect_to(root_path)
    end
  end
end
