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

  describe 'GET /test/tracking/page' do
    context 'with valid project_id' do
      it 'returns an HTML page with tracking script' do
        get "/test/tracking/page", params: { project_id: project.id }

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('text/html')

        # Verify the page contains the tracking config
        expect(response.body).to include('L10_CONFIG')
        expect(response.body).to include(project.signup_token)
        expect(response.body).to include('trackVisit')
        expect(response.body).to include('trackEvent')
      end

      it 'includes lead form' do
        get "/test/tracking/page", params: { project_id: project.id }

        expect(response.body).to include('lead-form')
        expect(response.body).to include('createLead')
      end
    end

    context 'with invalid project_id' do
      it 'returns 404' do
        get "/test/tracking/page", params: { project_id: 99999 }

        expect(response).to have_http_status(:not_found)
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

    it 'redirects page endpoint to root' do
      get "/test/tracking/page", params: { project_id: project.id }

      expect(response).to redirect_to(root_path)
    end
  end
end
