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

    it "persists attribution on the account after registration" do
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

      account = User.find_by(email: email).owned_account
      expect(account.signup_attribution).to be_present
      expect(account.signup_attribution["utm_source"]).to eq("google")
      expect(account.signup_attribution["utm_medium"]).to eq("cpc")
      expect(account.signup_attribution["utm_campaign"]).to eq("launch_beta")
      expect(account.signup_attribution["gclid"]).to eq("abc123")
      expect(account.signup_attribution["icp"]).to eq("saas-founders")
    end

    it "sets signup_attribution to nil when no UTMs are present" do
      get new_user_registration_path

      expect {
        post user_registration_path, params: valid_params
      }.to change(User, :count).by(1)

      expect(User.find_by(email: email).owned_account.signup_attribution).to be_nil
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
        headers: { "HTTP_REFERER" => "https://launch10.com/pricing" }

      attribution = JSON.parse(cookies[:signup_attribution])
      expect(attribution["referrer"]).to eq("https://launch10.com/pricing")
    end

    it "includes referring_domain extracted from referrer" do
      get new_user_registration_path,
        params: { utm_source: "google" },
        headers: { "HTTP_REFERER" => "https://www.google.com/search?q=test" }

      attribution = JSON.parse(cookies[:signup_attribution])
      expect(attribution["referring_domain"]).to eq("www.google.com")
    end

    it "prefers forwarded referrer param over HTTP Referer header" do
      get new_user_registration_path,
        params: {
          utm_source: "google",
          referrer: "https://www.google.com/search?q=test",
          referring_domain: "www.google.com"
        },
        headers: { "HTTP_REFERER" => "https://landing.launch10.site/coaches" }

      attribution = JSON.parse(cookies[:signup_attribution])
      expect(attribution["referrer"]).to eq("https://www.google.com/search?q=test")
      expect(attribution["referring_domain"]).to eq("www.google.com")
    end

    it "falls back to HTTP Referer when no forwarded referrer param" do
      get new_user_registration_path,
        params: { utm_source: "google" },
        headers: { "HTTP_REFERER" => "https://facebook.com/post/123" }

      attribution = JSON.parse(cookies[:signup_attribution])
      expect(attribution["referrer"]).to eq("https://facebook.com/post/123")
      expect(attribution["referring_domain"]).to eq("facebook.com")
    end

    it "extracts referring_domain from forwarded referrer when no referring_domain param" do
      get new_user_registration_path,
        params: {
          utm_source: "google",
          referrer: "https://www.google.com/search?q=test"
        }

      attribution = JSON.parse(cookies[:signup_attribution])
      expect(attribution["referring_domain"]).to eq("www.google.com")
    end

    it "does not set cookie for just a referrer with no UTMs" do
      get new_user_registration_path,
        headers: { "HTTP_REFERER" => "https://google.com" }

      expect(cookies[:signup_attribution]).to be_blank
    end

    it "handles malformed referrer URL gracefully" do
      get new_user_registration_path,
        params: {
          utm_source: "google",
          referrer: "not-a-valid-url"
        }

      attribution = JSON.parse(cookies[:signup_attribution])
      expect(attribution["referrer"]).to eq("not-a-valid-url")
      expect(attribution["referring_domain"]).to be_nil
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
