require 'rails_helper'

RSpec.describe "Registrations", type: :request do
  describe "UTM attribution tracking" do
    let(:email) { "test-#{SecureRandom.hex(4)}@example.com" }

    let(:valid_params) do
      {
        user: {
          name: "Test User",
          email: email,
          password: "password123",
          password_confirmation: "password123",
          terms_of_service: "1",
          owned_accounts_attributes: [{ name: "Test User" }]
        },
        spinner: InvisibleCaptcha.encode("#{Time.zone.now.iso8601}-127.0.0.1")
      }
    end

    it "captures UTM params from the signup URL into a cookie" do
      get new_user_registration_path, params: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "launch_beta"
      }

      expect(cookies[:signup_attribution]).to be_present
      attribution = JSON.parse(cookies[:signup_attribution])
      expect(attribution["utm_source"]).to eq("google")
      expect(attribution["utm_medium"]).to eq("cpc")
      expect(attribution["utm_campaign"]).to eq("launch_beta")
    end

    it "preserves first-touch attribution (does not overwrite cookie)" do
      # First visit with original UTMs
      get new_user_registration_path, params: {
        utm_source: "google",
        utm_campaign: "first_campaign"
      }

      first_attribution = JSON.parse(cookies[:signup_attribution])
      expect(first_attribution["utm_source"]).to eq("google")

      # Second visit with different UTMs — should not overwrite
      get new_user_registration_path, params: {
        utm_source: "facebook",
        utm_campaign: "second_campaign"
      }

      attribution = JSON.parse(cookies[:signup_attribution])
      expect(attribution["utm_source"]).to eq("google")
      expect(attribution["utm_campaign"]).to eq("first_campaign")
    end

    it "persists attribution on the user after registration" do
      get new_user_registration_path, params: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "launch_beta",
        gclid: "abc123",
        icp: "saas-founders"
      }

      expect {
        post user_registration_path, params: valid_params
      }.to change(User, :count).by(1)

      user = User.find_by(email: email)
      expect(user.signup_attribution).to be_present
      expect(user.signup_attribution["utm_source"]).to eq("google")
      expect(user.signup_attribution["utm_medium"]).to eq("cpc")
      expect(user.signup_attribution["utm_campaign"]).to eq("launch_beta")
      expect(user.signup_attribution["gclid"]).to eq("abc123")
      expect(user.signup_attribution["icp"]).to eq("saas-founders")
    end

    it "sets signup_attribution to nil when no UTMs are present" do
      get new_user_registration_path

      expect {
        post user_registration_path, params: valid_params
      }.to change(User, :count).by(1)

      expect(User.find_by(email: email).signup_attribution).to be_nil
    end

    it "clears the attribution cookie after successful signup" do
      get new_user_registration_path, params: { utm_source: "google" }
      expect(cookies[:signup_attribution]).to be_present

      post user_registration_path, params: valid_params

      expect(cookies[:signup_attribution]).to be_blank
    end

    it "does not set cookie when no UTM params are in the URL" do
      get new_user_registration_path

      expect(cookies[:signup_attribution]).to be_blank
    end

    it "includes referrer in attribution" do
      get new_user_registration_path,
        params: { utm_source: "google" },
        headers: { "HTTP_REFERER" => "https://launch10.ai/pricing" }

      attribution = JSON.parse(cookies[:signup_attribution])
      expect(attribution["referrer"]).to eq("https://launch10.ai/pricing")
    end

    it "includes landing_page URL in attribution" do
      get new_user_registration_path, params: { utm_source: "google", utm_campaign: "test" }

      attribution = JSON.parse(cookies[:signup_attribution])
      expect(attribution["landing_page"]).to include("/users/sign_up")
      expect(attribution["landing_page"]).to include("utm_source=google")
    end

    it "enriches the user_signed_up event with attribution data" do
      get new_user_registration_path, params: {
        utm_source: "google",
        utm_campaign: "launch_beta"
      }

      expect(TrackEvent).to receive(:call).with("user_signed_up",
        hash_including(
          method: "email",
          utm_source: "google",
          utm_campaign: "launch_beta"
        ))

      post user_registration_path, params: valid_params
    end
  end
end
