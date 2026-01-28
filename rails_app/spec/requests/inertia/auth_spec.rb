# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Auth Inertia Pages', type: :request, inertia: true do
  # Define the Google OAuth route helper since it's only available when omniauth-google-oauth2 gem is loaded
  before do
    unless Rails.application.routes.url_helpers.method_defined?(:user_google_oauth2_omniauth_authorize_path)
      Rails.application.routes.url_helpers.define_method(:user_google_oauth2_omniauth_authorize_path) do |**_opts|
        '/users/auth/google_oauth2'
      end
    end
  end

  describe 'GET /users/sign_in' do
    it 'renders the SignIn component' do
      get new_user_session_path

      expect(response).to have_http_status(:ok)
      expect(inertia.component).to eq('Auth/SignIn')
    end

    it 'props conform to SignIn schema' do
      get new_user_session_path

      expect_inertia_props_to_match_schema(InertiaSchemas::SignIn.props_schema)
    end
  end

  describe 'POST /users/sign_in' do
    let!(:user) { create(:user, email: 'test@example.com', password: 'password123', password_confirmation: 'password123') }

    context 'with valid credentials' do
      it 'signs in and redirects' do
        post user_session_path, params: { user: { email: 'test@example.com', password: 'password123' } }

        # Inertia redirects return 409 (Conflict) with X-Inertia-Location header
        expect(response).to have_http_status(:conflict)
        expect(response.headers['X-Inertia-Location']).to be_present
      end
    end

    context 'with invalid credentials' do
      it 'returns unprocessable entity with errors' do
        post user_session_path, params: { user: { email: 'test@example.com', password: 'wrongpassword' } }

        expect(response).to have_http_status(:unprocessable_entity)
        expect(inertia.component).to eq('Auth/SignIn')
        expect(inertia.props[:errors]).to be_present
      end

      it 'props conform to SignIn schema on error' do
        post user_session_path, params: { user: { email: 'test@example.com', password: 'wrongpassword' } }

        expect_inertia_props_to_match_schema(InertiaSchemas::SignIn.props_schema)
      end
    end
  end

  describe 'GET /users/sign_up' do
    it 'renders the SignUp component' do
      get new_user_registration_path

      expect(response).to have_http_status(:ok)
      expect(inertia.component).to eq('Auth/SignUp')
    end

    it 'props conform to SignUp schema' do
      get new_user_registration_path

      expect_inertia_props_to_match_schema(InertiaSchemas::SignUp.props_schema)
    end
  end

  describe 'POST /users (registration)' do
    context 'with valid data' do
      it 'creates user and redirects' do
        post user_registration_path, params: {
          user: {
            name: 'Test User',
            email: 'newuser@example.com',
            password: 'password123',
            password_confirmation: 'password123',
            terms_of_service: '1',
            owned_accounts_attributes: [{ name: 'Test User' }]
          },
          spinner: InvisibleCaptcha.encode("#{Time.zone.now.iso8601}-127.0.0.1")
        }

        # Inertia redirects return 409 (Conflict) with X-Inertia-Location header
        expect(response).to have_http_status(:conflict)
        expect(response.headers['X-Inertia-Location']).to be_present
        expect(User.find_by(email: 'newuser@example.com')).to be_present
      end
    end

    context 'with invalid data' do
      it 'returns unprocessable entity with errors' do
        post user_registration_path, params: {
          user: {
            name: '',
            email: 'invalid-email',
            password: 'short',
            password_confirmation: 'mismatch',
            terms_of_service: '1'
          },
          spinner: InvisibleCaptcha.encode("#{Time.zone.now.iso8601}-127.0.0.1")
        }

        expect(response).to have_http_status(:unprocessable_entity)
        expect(inertia.component).to eq('Auth/SignUp')
        expect(inertia.props[:errors]).to be_present
      end

      it 'props conform to SignUp schema on error' do
        post user_registration_path, params: {
          user: {
            name: '',
            email: 'invalid-email',
            password: 'short',
            password_confirmation: 'mismatch',
            terms_of_service: '1'
          },
          spinner: InvisibleCaptcha.encode("#{Time.zone.now.iso8601}-127.0.0.1")
        }

        expect_inertia_props_to_match_schema(InertiaSchemas::SignUp.props_schema)
      end
    end
  end
end
