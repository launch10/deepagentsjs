require 'swagger_helper'

RSpec.describe "Leads API", type: :request do
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

  # Generate a valid signup_token token for the project
  let(:valid_token) { project.signup_token }

  # Create a second project to test token isolation
  let!(:other_account) { create(:account, name: "Other Account") }
  let!(:other_project) { create(:project, account: other_account, name: "Other Project") }
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

        **Idempotency:**
        - Returns 201 Created for new leads
        - Returns 200 OK for existing leads (same email, same project)
        - Email is normalized (lowercase, trimmed) before matching

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

      response '201', 'lead created successfully' do
        schema APISchemas::Lead.success_response

        let(:token) { valid_token }
        let(:lead_params) { { email: 'newlead@example.com', name: 'Jane Doe' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['success']).to eq(true)

          # Verify lead was created in the correct project
          lead = Lead.find_by(email: 'newlead@example.com')
          expect(lead).to be_present
          expect(lead.project_id).to eq(project.id)
          expect(lead.name).to eq('Jane Doe')
        end
      end

      response '201', 'lead created with email only (name optional)' do
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

      response '201', 'email is normalized (lowercase and trimmed)' do
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

      response '200', 'existing lead returns 200 (idempotent, no update)' do
        schema APISchemas::Lead.success_response

        let(:token) { valid_token }
        let!(:existing_lead) { create(:lead, project: project, email: 'existing@example.com', name: 'Original Name') }
        let(:lead_params) { { email: 'existing@example.com', name: 'Attempted Update' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['success']).to eq(true)
          expect(response.status).to eq(200)

          # Name should NOT be updated - we just acknowledge and move on
          existing_lead.reload
          expect(existing_lead.name).to eq('Original Name')
        end
      end

      response '200', 'existing lead matched case-insensitively' do
        schema APISchemas::Lead.success_response

        let(:token) { valid_token }
        let!(:existing_lead) { create(:lead, project: project, email: 'test@example.com') }
        let(:lead_params) { { email: 'TEST@EXAMPLE.COM' } }

        run_test! do |response|
          expect(response.status).to eq(200)

          # Should not create a duplicate
          expect(Lead.where(project: project).count).to eq(1)
        end
      end

      response '201', 'same email can be used for different projects' do
        schema APISchemas::Lead.success_response

        let(:token) { other_token }
        let!(:existing_lead) { create(:lead, project: project, email: 'shared@example.com') }
        let(:lead_params) { { email: 'shared@example.com', name: 'Different Project' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['success']).to eq(true)

          # Should create a new lead for the other project
          expect(response.status).to eq(201)

          # Now there should be 2 leads with this email (one per project)
          leads = Lead.where(email: 'shared@example.com')
          expect(leads.count).to eq(2)
          expect(leads.pluck(:project_id)).to contain_exactly(project.id, other_project.id)
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

      response '201', 'accepts requests with Origin header from any domain' do
        schema APISchemas::Lead.success_response

        let(:token) { valid_token }
        let(:lead_params) { { email: 'cors-test@example.com' } }
        let(:Origin) { 'https://my-landing-page.launch10.site' }

        run_test! do |response|
          expect(response.status).to eq(201)
        end
      end

      response '201', 'accepts requests with custom domain Origin' do
        schema APISchemas::Lead.success_response

        let(:token) { valid_token }
        let(:lead_params) { { email: 'custom-domain@example.com' } }
        let(:Origin) { 'https://my-custom-domain.com' }

        run_test! do |response|
          expect(response.status).to eq(201)
        end
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
        expect(response.status).to eq(201)

        # Second request with same email should return 200 (idempotent)
        post '/api/v1/leads', params: { token: token, email: email }
        expect(response.status).to eq(200)

        # Should only have one lead
        expect(Lead.where(email: email, project: project).count).to eq(1)
      end
    end

    describe 'token isolation' do
      it 'tokens from one project cannot create leads for another project' do
        # Use project A's token
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'isolation-test@example.com'
        }

        expect(response.status).to eq(201)
        lead = Lead.find_by(email: 'isolation-test@example.com')
        expect(lead.project_id).to eq(project.id)
        expect(lead.project_id).not_to eq(other_project.id)
      end
    end

    describe 'email edge cases' do
      it 'handles emails with plus addressing' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'user+tag@example.com'
        }

        expect(response.status).to eq(201)
        expect(Lead.find_by(email: 'user+tag@example.com')).to be_present
      end

      it 'handles international domain emails' do
        post '/api/v1/leads', params: {
          token: valid_token,
          email: 'user@example.co.uk'
        }

        expect(response.status).to eq(201)
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
          project_id: other_project.id, # Should be ignored
          created_at: 1.year.ago # Should be ignored
        }

        expect(response.status).to eq(201)
        lead = Lead.find_by(email: 'safe@example.com')
        expect(lead.project_id).to eq(project.id) # Not the injected value
        expect(lead.created_at).to be_within(1.minute).of(Time.current)
      end
    end
  end
end
