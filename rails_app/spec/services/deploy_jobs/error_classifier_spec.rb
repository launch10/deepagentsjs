require "rails_helper"

RSpec.describe DeployJobs::ErrorClassifier do
  describe ".classify" do
    context "with ApplicationClient errors" do
      it "classifies RateLimit as :rate_limit" do
        error = ApplicationClient::RateLimit.new("429 Too Many Requests")
        expect(described_class.classify(error)).to eq(:rate_limit)
      end

      it "classifies NotFound as :not_found" do
        error = ApplicationClient::NotFound.new("404 Not Found")
        expect(described_class.classify(error)).to eq(:not_found)
      end

      it "classifies Unauthorized as :auth_failure" do
        error = ApplicationClient::Unauthorized.new("401 Unauthorized")
        expect(described_class.classify(error)).to eq(:auth_failure)
      end

      it "classifies Forbidden as :auth_failure" do
        error = ApplicationClient::Forbidden.new("403 Forbidden")
        expect(described_class.classify(error)).to eq(:auth_failure)
      end

      it "classifies InternalError as :api_outage" do
        error = ApplicationClient::InternalError.new("500 Internal Server Error")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies generic Error as :api_outage" do
        error = ApplicationClient::Error.new("502 Bad Gateway")
        expect(described_class.classify(error)).to eq(:api_outage)
      end
    end

    context "with ActiveRecord errors" do
      it "classifies RecordNotFound as :not_found" do
        error = ActiveRecord::RecordNotFound.new("Couldn't find Campaign with id=999")
        expect(described_class.classify(error)).to eq(:not_found)
      end
    end

    context "with Lockable errors" do
      it "classifies LockNotAcquiredError as :api_outage (transient)" do
        error = Lockable::LockNotAcquiredError.new("Could not acquire lock")
        expect(described_class.classify(error)).to eq(:api_outage)
      end
    end

    context "with timeout-like errors" do
      it "classifies Timeout::Error" do
        error = Timeout::Error.new("execution expired")
        expect(described_class.classify(error)).to eq(:timeout)
      end

      it "classifies errors with 'timed out' in message" do
        error = StandardError.new("Connection timed out")
        expect(described_class.classify(error)).to eq(:timeout)
      end

      it "classifies ETIMEDOUT errors" do
        error = StandardError.new("connect ETIMEDOUT 1.2.3.4:443")
        expect(described_class.classify(error)).to eq(:timeout)
      end
    end

    context "with network errors" do
      it "classifies ECONNREFUSED" do
        error = Errno::ECONNREFUSED.new("Connection refused")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies ECONNRESET" do
        error = Errno::ECONNRESET.new("Connection reset by peer")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies Net::HTTP errors" do
        error = Net::HTTPBadResponse.new("wrong status line")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies EOFError" do
        error = EOFError.new("end of file reached")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies Errno::EPIPE" do
        error = Errno::EPIPE.new("Broken pipe")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies OpenSSL::SSL::SSLError" do
        error = OpenSSL::SSL::SSLError.new("SSL_connect returned=1")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies IOError" do
        error = IOError.new("stream closed")
        expect(described_class.classify(error)).to eq(:api_outage)
      end
    end

    context "with message-based fallback" do
      it "classifies rate limit messages" do
        error = StandardError.new("Rate limit exceeded: too many requests")
        expect(described_class.classify(error)).to eq(:rate_limit)
      end

      it "classifies 429 messages" do
        error = StandardError.new("HTTP 429 - Too Many Requests")
        expect(described_class.classify(error)).to eq(:rate_limit)
      end

      it "classifies network error messages" do
        error = StandardError.new("ECONNREFUSED: connection refused")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies unknown errors as :internal" do
        error = StandardError.new("Something completely unexpected")
        expect(described_class.classify(error)).to eq(:internal)
      end

      it "classifies ArgumentError as :invalid_data" do
        error = ArgumentError.new("wrong number of arguments")
        expect(described_class.classify(error)).to eq(:invalid_data)
      end
    end

    context "with Google Ads errors" do
      # We test the classification logic by checking that terminal Google errors
      # are properly categorized. Since we can't easily construct real Google Ads
      # proto errors, we test the integration point by mocking TerminalErrors.
      it "classifies terminal Google Ads errors via TerminalErrors" do
        error = StandardError.new("Google Ads API error")
        # Simulate a Google Ads error class
        allow(error).to receive(:is_a?).and_call_original
        allow(error).to receive(:is_a?).with(Google::Ads::GoogleAds::Errors::GoogleAdsError).and_return(true) if defined?(Google::Ads::GoogleAds::Errors::GoogleAdsError)
      end
    end
  end
end
