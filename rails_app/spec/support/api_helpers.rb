module ApiHelpers
  def mock_api_response(mock_response, code: 200)
    Cloudflare::FirewallService::Response.new(
      OpenStruct.new(
        code: code,
        body: mock_response
      )
    )
  end
end