require 'rails_helper'

RSpec.describe "Account Switching via JWT", type: :request do
  let(:user) { create(:user) }
  let!(:owned_account) { user.owned_account }
  let!(:team_account) { create_account_with_user(user, account_name: "Team Account") }

  before do
    ensure_plans_exist
    subscribe_account(owned_account, plan_name: 'pro')
    subscribe_account(team_account, plan_name: 'pro')
  end

  it "defaults to owned account when no account specified" do
    token = generate_jwt_for(user)
    payload = JWT.decode(token, Rails.application.credentials.devise_jwt_secret_key, true, {algorithm: "HS256"})
    
    expect(payload.dig(0, "account_id")).to eq(owned_account.id)
  end

  it "switches to team account when using switch_account_to" do
    switch_account_to(team_account)
    
    token = generate_jwt_for(user)
    payload = JWT.decode(token, Rails.application.credentials.devise_jwt_secret_key, true, {algorithm: "HS256"})
    
    expect(payload.dig(0, "account_id")).to eq(team_account.id)
  end
end
