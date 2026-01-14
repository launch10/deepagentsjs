require 'swagger_helper'
require 'sidekiq/testing'

RSpec.describe "Leads API", type: :request do
  before do
    Sidekiq::Testing.inline! unless self.class.metadata[:sidekiq] == :fake
  end

  # ==========================================================================
  # SECURITY CONTEXT
  # ==========================================================================
  # This is a PUBLIC endpoint - no JWT/session authentication required.
  # Authentication is via Rails signed_id token passed as a query parameter.
  #
  # Key security properties:
  # 1. Token is cryptographically signed using Rails' secret_key_base
  # 2. Token is purpose-scoped (:lead_signup) - can't be used for other operations
  # 3. Invalid/tampered tokens return 401 (no information leakage about projects)
  # 4. CORS configured to allow all origins, but ONLY for this endpoint
  # 5. No cookies/credentials sent (credentials: false in CORS config)
  #
  # The signup_token token is embedded in deployed landing pages at build time
  # via the VITE_SIGNUP_TOKEN environment variable.
  # ==========================================================================

  # ==========================================================================
  # ORIGIN VALIDATION: Intentionally NOT implemented
  # ==========================================================================
  # See decisions/coding_agent/leads_backend.md for rationale.
  # TL;DR: Origin headers are trivially spoofable, making this security theater.
  # ==========================================================================

  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account, name: "Test Landing Page") }
  let!(:website) { create(:website, project: project, account: account) }

  # Generate a valid signup_token token for the project
  let(:valid_token) { project.signup_token }

  # Create a second project to test token isolation
  let!(:other_account) { create(:account, name: "Other Account") }
  let!(:other_project) { create(:project, account: other_account, name: "Other Project") }
  let!(:other_website) { create(:website, project: other_project, account: other_account) }
  let(:other_token) { other_project.signup_token }

  path '/api/v1/leads' do
    post 'Creates a lead signup from a deployed landing page' do
      tags 'Leads'
      description <<~DESC
        Public endpoint for landing pages to submit email signups.
        This endpoint is called from deployed landing pages and uses a signed token
        for authentication instead of JWT/session auth.

        **Authentication:**
        - Token passed as query parameter `token`
        - Token is a Rails signup_token generated from the project
        - Token is purpose-scoped to :lead_signup

        **Processing:**
        - Returns 202 Accepted immediately
        - Lead creation happens asynchronously via background job
        - Email validation happens synchronously (422 returned for invalid emails)

        **CORS:**
        - Allows requests from any origin
        - Only Content-Type header allowed
        - No credentials/cookies sent
      DESC

      consumes 'application/json'
      produces 'application/json'

      # Token parameter (query string)
      parameter name: :token,
        in: :query,
        schema: APISchemas::Lead.token_schema,
        required: true,
        description: 'Signed ID token authenticating the request'

      # Request body
      parameter name: :lead_params,
        in: :body,
        schema: APISchemas::Lead.params_schema,
        description: 'Lead signup data'

      # Optional Origin header for future validation
      parameter name: :Origin,
        in: :header,
        type: :string,
        required: false,
        description: 'Origin of the request (for future CSRF protection via origin validation)'

      # ========================================================================
      # SUCCESS CASES
      # ========================================================================

      response '202', 'lead accepted for processing' do
        schema APISchemas::Lead.success_response

        let(:token) { valid_token }
        let(:lead_params) { { email: 'newlead@example.com', name: 'Jane Doe' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['success']).to eq(true)

          # Process the job to verify lead creation

          lead = Lead.find_by(email: 'newlead@example.com')
          expect(lead).to be_present
          expect(lead.account_id).to eq(account.id)
          expect(lead.name).to eq('Jane Doe')
          expect(lead.websites).to include(website)
        end
      end

      response '202', 'lead accepted with email only (name optional)' do
        schema APISchemas::Lead.success_response

        let(:token) { valid_token }
        let(:lead_params) { { email: 'emailonly@example.com' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['success']).to eq(true)

          lead = Lead.find_by(email: 'emailonly@example.com')
          expect(lead).to be_present
          expect(lead.name).to be_nil
        end
      end

      response '202', 'email is normalized (lowercase and trimmed)' do
        schema APISchemas::Lead.success_response

        let(:token) { valid_token }
        let(:lead_params) { { email: '  UPPERCASE@EXAMPLE.COM  ', name: 'Normalized Test' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['success']).to eq(true)

          # Email should be normalized
          lead = Lead.find_by(email: 'uppercase@example.com')
          expect(lead).to be_present
        end
      end

      response '202', 'existing lead returns 202 (idempotent)' do
        schema APISchemas::Lead.success_response

        let(:token) { valid_token }
        let!(:existing_lead) { create(:lead, account: account, email: 'existing@example.com', name: 'Original Name') }
        let!(:existing_website_lead) { create(:website_lead, lead: existing_lead, website: website) }
        let(:lead_params) { { email: 'existing@example.com', name: 'Attempted Update' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['success']).to eq(true)
          expect(response.status).to eq(202)

          # Name should NOT be updated - we just acknowledge and move on
          existing_lead.reload
          expect(existing_lead.name).to eq('Original Name')
        end
      end

      response '202', 'existing lead matched case-insensitively' do
        schema APISchemas::Lead.success_response

        let(:token) { valid_token }
        let!(:existing_lead) { create(:lead, account: account, email: 'test@example.com') }
        let!(:existing_website_lead) { create(:website_lead, lead: existing_lead, website: website) }
        let(:lead_params) { { email: 'TEST@EXAMPLE.COM' } }

        run_test! do |response|
          expect(response.status).to eq(202)

          # Should not create a duplicate
          expect(website.leads.count).to eq(1)
        end
      end

      response '202', 'same email can be used for different accounts' do
        schema APISchemas::Lead.success_response

        let(:token) { other_token }
        let!(:existing_lead) { create(:lead, account: account, email: 'shared@example.com') }
        let!(:existing_website_lead) { create(:website_lead, lead: existing_lead, website: website) }
        let(:lead_params) { { email: 'shared@example.com', name: 'Different Account' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['success']).to eq(true)

          # Now there should be 2 leads with this email (one per account)
          leads = Lead.where(email: 'shared@example.com')
          expect(leads.count).to eq(2)
          expect(leads.pluck(:account_id)).to contain_exactly(account.id, other_account.id)
        end
      end

      # ========================================================================
      # AUTHENTICATION FAILURE CASES
      # ========================================================================

      response '401', 'missing token returns unauthorized' do
        schema APISchemas::Lead.auth_error_response

        let(:token) { nil }
        let(:lead_params) { { email: 'test@example.com' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['error']).to eq('Invalid token')
        end
      end

      response '401', 'invalid token returns unauthorized' do
        schema APISchemas::Lead.auth_error_response

        let(:token) { 'completely-invalid-token' }
        let(:lead_params) { { email: 'test@example.com' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['error']).to eq('Invalid token')
        end
      end

      response '401', 'tampered token returns unauthorized' do
        schema APISchemas::Lead.auth_error_response

        let(:token) { "#{valid_token}tampered" }
        let(:lead_params) { { email: 'test@example.com' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['error']).to eq('Invalid token')
        end
      end

      response '401', 'token with wrong purpose returns unauthorized' do
        schema APISchemas::Lead.auth_error_response

        # Generate a token with a different purpose
        let(:token) { project.signed_id(purpose: :wrong_purpose) }
        let(:lead_params) { { email: 'test@example.com' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['error']).to eq('Invalid token')
        end
      end

      response '401', 'deleted project returns unauthorized (no information leakage)' do
        schema APISchemas::Lead.auth_error_response

        let!(:deleted_project) { create(:project, account: account, name: "To Be Deleted") }
        let(:token) { deleted_project.signup_token }
        let(:lead_params) { { email: 'test@example.com' } }

        before do
          # Delete the project after generating the token
          deleted_project.destroy!
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          # Should return same error as invalid token (no leakage)
          expect(data['error']).to eq('Invalid token')
        end
      end

      # ========================================================================
      # VALIDATION FAILURE CASES
      # ========================================================================

      response '422', 'missing email returns validation error' do
        schema APISchemas::Lead.validation_error_response

        let(:token) { valid_token }
        let(:lead_params) { { name: 'No Email Person' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']['email']).to include("can't be blank")
        end
      end

      response '422', 'invalid email format returns validation error' do
        schema APISchemas::Lead.validation_error_response

        let(:token) { valid_token }
        let(:lead_params) { { email: 'not-an-email' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']['email']).to include('is invalid')
        end
      end

      response '422', 'email too long returns validation error' do
        schema APISchemas::Lead.validation_error_response

        let(:token) { valid_token }
        let(:lead_params) { { email: "#{"a" * 250}@example.com" } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']['email']).to include('is too long (maximum is 255 characters)')
        end
      end

      response '422', 'name too long returns validation error' do
        schema APISchemas::Lead.validation_error_response

        let(:token) { valid_token }
        let(:lead_params) { { email: 'valid@example.com', name: 'a' * 256 } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['errors']['name']).to include('is too long (maximum is 255 characters)')
        end
      end

      # ========================================================================
      # CORS BEHAVIOR (documented for API consumers)
      # ========================================================================

      # Note: CORS preflight (OPTIONS) is handled by rack-cors middleware
      # and doesn't hit the controller. These tests document the expected
      # behavior for API consumers.

      response '202', 'accepts requests with Origin header from any domain' do
        schema APISchemas::Lead.success_response

        let(:token) { valid_token }
        let(:lead_params) { { email: 'cors-test@example.com' } }
        let(:Origin) { 'https://my-landing-page.launch10.site' }

        run_test! do |response|
          expect(response.status).to eq(202)
        end
      end

      response '202', 'accepts requests with custom domain Origin' do
        schema APISchemas::Lead.success_response

        let(:token) { valid_token }
        let(:lead_params) { { email: 'custom-domain@example.com' } }
        let(:Origin) { 'https://my-custom-domain.com' }

        run_test! do |response|
          expect(response.status).to eq(202)
        end
      end
    end
  end

  # ==========================================================================
  # VISIT AND GCLID TRACKING TESTS
  # ==========================================================================

  describe 'visit and gclid tracking' do
    # Note: website is already created in the outer let! block

    describe 'gclid capture' do
      it 'stores gclid on the website_lead' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'gclid-test@example.com',
          gclid: 'test-gclid-12345'
        }

        expect(response.status).to eq(202)

        lead = Lead.find_by(email: 'gclid-test@example.com')
        website_lead = lead.website_leads.find_by(website: website)
        expect(website_lead.gclid).to eq('test-gclid-12345')
      end

      it 'works without gclid' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'no-gclid@example.com'
        }

        expect(response.status).to eq(202)

        lead = Lead.find_by(email: 'no-gclid@example.com')
        website_lead = lead.website_leads.find_by(website: website)
        expect(website_lead.gclid).to be_nil
      end
    end

    describe 'visit association' do
      let!(:visit) do
        Ahoy::Visit.create!(
          website_id: website.id,
          visitor_token: 'visitor-abc',
          visit_token: 'visit-xyz',
          gclid: 'visit-gclid-999',
          started_at: Time.current
        )
      end

      it 'links website_lead to existing visit' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'visit-link@example.com',
          visitor_token: 'visitor-abc',
          visit_token: 'visit-xyz'
        }

        expect(response.status).to eq(202)

        lead = Lead.find_by(email: 'visit-link@example.com')
        website_lead = lead.website_leads.find_by(website: website)
        expect(website_lead.visit_id).to eq(visit.id)
      end

      it 'stores visitor_token on website_lead for multi-touch attribution' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'visitor-token-test@example.com',
          visitor_token: 'visitor-abc',
          visit_token: 'visit-xyz'
        }

        expect(response.status).to eq(202)

        lead = Lead.find_by(email: 'visitor-token-test@example.com')
        website_lead = lead.website_leads.find_by(website: website)
        expect(website_lead.visitor_token).to eq('visitor-abc')
      end

      it 'inherits gclid from visit if not provided directly' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'inherit-gclid@example.com',
          visitor_token: 'visitor-abc',
          visit_token: 'visit-xyz'
        }

        expect(response.status).to eq(202)

        lead = Lead.find_by(email: 'inherit-gclid@example.com')
        website_lead = lead.website_leads.find_by(website: website)
        expect(website_lead.gclid).to eq('visit-gclid-999')
      end

      it 'prefers directly provided gclid over visit gclid' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'prefer-direct-gclid@example.com',
          visitor_token: 'visitor-abc',
          visit_token: 'visit-xyz',
          gclid: 'direct-gclid-override'
        }

        expect(response.status).to eq(202)

        lead = Lead.find_by(email: 'prefer-direct-gclid@example.com')
        website_lead = lead.website_leads.find_by(website: website)
        expect(website_lead.gclid).to eq('direct-gclid-override')
      end
    end

    describe 'conversion event tracking' do
      let!(:visit) do
        Ahoy::Visit.create!(
          website_id: website.id,
          visitor_token: 'visitor-conv',
          visit_token: 'visit-conv',
          started_at: Time.current
        )
      end

      it 'creates a conversion event when visit is linked' do
        expect {
          post '/api/v1/leads', params: {
            token: valid_token,
            email: 'conversion-event@example.com',
            visitor_token: 'visitor-conv',
            visit_token: 'visit-conv'
          }
        }.to change(Ahoy::Event, :count).by(1)

        expect(response.status).to eq(202)

        event = Ahoy::Event.last
        expect(event.name).to eq('conversion')
        expect(event.visit_id).to eq(visit.id)
        expect(event.properties['email']).to eq('conversion-event@example.com')
      end

      it 'stores conversion value and currency in event properties' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'conversion-value@example.com',
          visitor_token: 'visitor-conv',
          visit_token: 'visit-conv',
          conversion_value: 99.99,
          conversion_currency: 'USD'
        }

        expect(response.status).to eq(202)

        event = Ahoy::Event.last
        expect(event.name).to eq('conversion')
        expect(event.properties['value']).to eq(99.99)
        expect(event.properties['currency']).to eq('USD')
      end

      it 'defaults currency to USD when value is provided without currency' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'conversion-default-currency@example.com',
          visitor_token: 'visitor-conv',
          visit_token: 'visit-conv',
          conversion_value: 50.00
        }

        expect(response.status).to eq(202)

        event = Ahoy::Event.last
        expect(event.properties['value']).to eq(50.00)
        expect(event.properties['currency']).to eq('USD')
      end

      it 'does not include value/currency when not provided' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'conversion-no-value@example.com',
          visitor_token: 'visitor-conv',
          visit_token: 'visit-conv'
        }

        expect(response.status).to eq(202)

        event = Ahoy::Event.last
        expect(event.properties).not_to have_key('value')
        expect(event.properties).not_to have_key('currency')
      end

      it 'does not create conversion event without visit' do
        expect {
          post '/api/v1/leads', params: {
            token: valid_token,
            email: 'no-conversion-event@example.com'
          }
        }.not_to change(Ahoy::Event, :count)

        expect(response.status).to eq(202)
      end
    end

    describe 'visit creation on lead submission' do
      it 'creates visit if visitor_token and visit_token provided but visit does not exist' do
        expect {
          post '/api/v1/leads', params: {
            token: valid_token,
            email: 'new-visit@example.com',
            visitor_token: 'new-visitor-token',
            visit_token: 'new-visit-token',
            gclid: 'new-gclid'
          }
        }.to change(Ahoy::Visit, :count).by(1)

        expect(response.status).to eq(202)

        visit = Ahoy::Visit.last
        expect(visit.visitor_token).to eq('new-visitor-token')
        expect(visit.visit_token).to eq('new-visit-token')
        expect(visit.gclid).to eq('new-gclid')
        expect(visit.website_id).to eq(website.id)

        lead = Lead.find_by(email: 'new-visit@example.com')
        website_lead = lead.website_leads.find_by(website: website)
        expect(website_lead.visit_id).to eq(visit.id)
      end
    end
  end

  # ==========================================================================
  # ADDITIONAL NON-RSWAG TESTS FOR EDGE CASES
  # ==========================================================================

  describe 'edge cases' do
    describe 'concurrent requests' do
      it 'handles concurrent signups gracefully (unique constraint)' do
        token = valid_token
        email = 'concurrent@example.com'

        # First request should succeed
        post '/api/v1/leads', params: { token: token, email: email }
        expect(response.status).to eq(202)

        # Second request with same email should also return 202 (idempotent)
        post '/api/v1/leads', params: { token: token, email: email }
        expect(response.status).to eq(202)

        # Should only have one lead in account and one website_lead
        expect(account.leads.where(email: email).count).to eq(1)
        expect(website.leads.where(email: email).count).to eq(1)
      end
    end

    describe 'token isolation' do
      it 'tokens from one project create leads in the correct account and website' do
        # Use project A's token
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'isolation-test@example.com'
        }

        expect(response.status).to eq(202)

        lead = Lead.find_by(email: 'isolation-test@example.com')
        expect(lead.account_id).to eq(account.id)
        expect(lead.websites).to include(website)
        expect(lead.websites).not_to include(other_website)
      end
    end

    describe 'email edge cases' do
      it 'handles emails with plus addressing' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'user+tag@example.com'
        }

        expect(response.status).to eq(202)

        expect(Lead.find_by(email: 'user+tag@example.com')).to be_present
      end

      it 'handles international domain emails' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'user@example.co.uk'
        }

        expect(response.status).to eq(202)
      end

      it 'rejects empty email' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: ''
        }

        expect(response.status).to eq(422)
      end

      it 'rejects whitespace-only email' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: '   '
        }

        expect(response.status).to eq(422)
      end
    end

    describe 'parameter handling' do
      it 'ignores unknown parameters (no mass assignment vulnerability)' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'safe@example.com',
          account_id: other_account.id, # Should be ignored
          created_at: 1.year.ago # Should be ignored
        }

        expect(response.status).to eq(202)

        lead = Lead.find_by(email: 'safe@example.com')
        expect(lead.account_id).to eq(account.id) # Not the injected value
        expect(lead.created_at).to be_within(1.minute).of(Time.current)
      end
    end

    describe 'background worker processing', sidekiq: :fake do
      before do
        Sidekiq::Testing.fake!
        Leads::ProcessWorker.jobs.clear
      end

      it 'enqueues a Leads::ProcessWorker' do
        expect {
          post '/api/v1/leads', params: {
            token: valid_token,
            email: 'worker-test@example.com'
          }
        }.to change(Leads::ProcessWorker.jobs, :size).by(1)
      end

      it 'enqueues worker with correct arguments' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'args-test@example.com',
          name: 'Test Person',
          gclid: 'test-gclid'
        }

        job = Leads::ProcessWorker.jobs.last
        expect(job['args']).to eq([
          account.id,
          website.id,
          'args-test@example.com',
          'Test Person',
          nil,
          nil,
          'test-gclid',
          nil,  # conversion_value
          nil   # conversion_currency
        ])
      end

      it 'enqueues worker with conversion value and currency' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'conversion-args@example.com',
          conversion_value: 99.99,
          conversion_currency: 'EUR'
        }

        job = Leads::ProcessWorker.jobs.last
        expect(job['args']).to eq([
          account.id,
          website.id,
          'conversion-args@example.com',
          nil,
          nil,
          nil,
          nil,
          99.99,
          'EUR'
        ])
      end
    end
  end
end
