require 'rails_helper'

RSpec.describe "Sessions", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:user) { create(:user) }

  before do
    ensure_plans_exist
    subscribe_account(user.owned_account, plan_name: "growth_monthly")
  end

  describe "DELETE /users/sign_out" do
    before do
      sign_in user
      # Ensure JWT is set after sign in
      get root_path
    end

    it "clears the JWT cookie" do
      expect(cookies[:jwt]).to be_present

      delete destroy_user_session_path

      expect(cookies[:jwt]).to be_blank
    end

    it "signs out the user" do
      delete destroy_user_session_path

      expect(controller.current_user).to be_nil
    end
  end
end
