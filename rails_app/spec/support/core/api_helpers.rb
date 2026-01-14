module APIHelpers
  def mock_api_response(mock_response, code: 200)
    # Create a mock HTTP response
    http_response = OpenStruct.new(
      code: code.to_s,
      body: mock_response.to_json,
      each_header: {
        "content-type" => "application/json"
      }.each
    )

    # Return the Response object for FirewallService
    Cloudflare::FirewallService::Response.new(http_response)
  end
end

RSpec.configure do |config|
  config.include APIHelpers
end
