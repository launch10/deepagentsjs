class Users::ReferralsController < ApplicationController
  before_action :authenticate_user!

  def index
    @referral_code = current_user.referral_codes.first_or_create
    TrackEvent.call("referral_code_viewed",
      user: current_user,
      account: current_account,
      referral_code: @referral_code.code)
  end
end
