require 'webmock/rspec'

# Configure WebMock to work with Typhoeus
WebMock.disable_net_connect!(allow_localhost: true)

RSpec.configure do |config|
  config.before(:each) do
    WebMock.reset!
  end
end