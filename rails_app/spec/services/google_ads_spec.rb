require 'rails_helper'

RSpec.describe GoogleAds do
  describe '.log_level' do
    context 'in production' do
      before { allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("production")) }

      it 'returns INFO for production to log summaries only' do
        expect(described_class.log_level).to eq("INFO")
      end
    end

    context 'in development' do
      before { allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("development")) }

      it 'returns DEBUG for development to log full payloads' do
        expect(described_class.log_level).to eq("DEBUG")
      end
    end

    context 'in test' do
      it 'returns DEBUG for test environment' do
        expect(described_class.log_level).to eq("DEBUG")
      end
    end
  end

  describe '.reset_client!' do
    it 'clears the cached client' do
      # Access the client to cache it
      allow(Google::Ads::GoogleAds::GoogleAdsClient).to receive(:new).and_return(double("Client"))
      described_class.client

      # Reset
      described_class.reset_client!

      # Should create a new client on next access
      expect(Google::Ads::GoogleAds::GoogleAdsClient).to receive(:new).and_return(double("NewClient"))
      described_class.client
    end
  end

  describe '.client' do
    let(:mock_client) { double("Google::Ads::GoogleAds::GoogleAdsClient") }

    before do
      described_class.reset_client!
      allow(Google::Ads::GoogleAds::GoogleAdsClient).to receive(:new).and_yield(mock_client).and_return(mock_client)
      allow(mock_client).to receive(:client_id=)
      allow(mock_client).to receive(:client_secret=)
      allow(mock_client).to receive(:refresh_token=)
      allow(mock_client).to receive(:developer_token=)
      allow(mock_client).to receive(:login_customer_id=)
      allow(mock_client).to receive(:log_level=)
      allow(mock_client).to receive(:logger=)
    end

    after { described_class.reset_client! }

    it 'sets the log level' do
      expect(mock_client).to receive(:log_level=).with("DEBUG")
      described_class.client
    end

    it 'memoizes the client' do
      expect(Google::Ads::GoogleAds::GoogleAdsClient).to receive(:new).once.and_return(mock_client)
      2.times { described_class.client }
    end
  end
end
