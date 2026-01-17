class Test::E2eController < Test::TestController
  # POST /test/e2e/set_invite_status
  def set_invite_status
    GoogleAds.e2e_mock_client ||= Testing::E2eGoogleAdsClient.new
    GoogleAds.e2e_mock_client.invite_status = params[:status]
    render json: { status: "ok" }
  end

  # DELETE /test/e2e/reset
  def reset
    GoogleAds.e2e_mock_client = nil
    render json: { status: "ok" }
  end
end
