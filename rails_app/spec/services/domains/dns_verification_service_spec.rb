require "rails_helper"

RSpec.describe Domains::DnsVerificationService do
  let(:account) { create(:account) }

  describe "#verify" do
    context "when domain is a platform subdomain" do
      let(:domain) { create(:domain, domain: "test.launch10.site", account: account, is_platform_subdomain: true) }

      it "returns verified immediately without DNS lookup" do
        service = described_class.new(domain)
        result = service.verify

        expect(result[:status]).to eq("verified")
        expect(result[:actual_cname]).to be_nil
        expect(result[:error]).to be_nil
      end

      it "does not update the domain record" do
        service = described_class.new(domain)
        expect { service.verify }.not_to change { domain.reload.dns_verification_status }
      end
    end

    context "when domain is a custom domain" do
      let(:domain) { create(:domain, domain: "www.mybusiness.com", account: account, is_platform_subdomain: false) }

      context "when CNAME is correctly configured" do
        before do
          allow_any_instance_of(described_class).to receive(:lookup_cname)
            .with("www.mybusiness.com")
            .and_return("cname.launch10.com")
        end

        it "returns verified status" do
          service = described_class.new(domain)
          result = service.verify

          expect(result[:status]).to eq("verified")
          expect(result[:actual_cname]).to eq("cname.launch10.com")
          expect(result[:error]).to be_nil
        end

        it "updates domain to verified" do
          service = described_class.new(domain)
          service.verify

          domain.reload
          expect(domain.dns_verification_status).to eq("verified")
          expect(domain.dns_last_checked_at).to be_present
          expect(domain.dns_error_message).to be_nil
        end
      end

      context "when CNAME points to wrong target" do
        before do
          allow_any_instance_of(described_class).to receive(:lookup_cname)
            .with("www.mybusiness.com")
            .and_return("wrong.target.com")
        end

        it "returns pending status" do
          service = described_class.new(domain)
          result = service.verify

          expect(result[:status]).to eq("pending")
          expect(result[:actual_cname]).to eq("wrong.target.com")
          expect(result[:error]).to include("Expected cname.launch10.com")
        end

        it "updates domain to pending with error message" do
          service = described_class.new(domain)
          service.verify

          domain.reload
          expect(domain.dns_verification_status).to eq("pending")
          expect(domain.dns_last_checked_at).to be_present
          expect(domain.dns_error_message).to eq("CNAME not configured")
        end
      end

      context "when no CNAME record exists" do
        before do
          allow_any_instance_of(described_class).to receive(:lookup_cname)
            .with("www.mybusiness.com")
            .and_return(nil)
        end

        it "returns pending status" do
          service = described_class.new(domain)
          result = service.verify

          expect(result[:status]).to eq("pending")
          expect(result[:actual_cname]).to be_nil
          expect(result[:error]).to include("nothing")
        end

        it "updates domain to pending" do
          service = described_class.new(domain)
          service.verify

          domain.reload
          expect(domain.dns_verification_status).to eq("pending")
        end
      end

      context "when DNS lookup raises Resolv::ResolvError" do
        before do
          allow_any_instance_of(described_class).to receive(:lookup_cname)
            .and_raise(Resolv::ResolvError.new("DNS query failed"))
        end

        it "returns pending status with error" do
          service = described_class.new(domain)
          result = service.verify

          expect(result[:status]).to eq("pending")
          expect(result[:error]).to include("DNS lookup failed")
        end

        it "updates domain to pending" do
          service = described_class.new(domain)
          service.verify

          domain.reload
          expect(domain.dns_verification_status).to eq("pending")
          expect(domain.dns_error_message).to include("DNS query failed")
        end
      end

      context "when unexpected error occurs" do
        before do
          allow_any_instance_of(described_class).to receive(:lookup_cname)
            .and_raise(StandardError.new("Unexpected error"))
        end

        it "returns failed status" do
          service = described_class.new(domain)
          result = service.verify

          expect(result[:status]).to eq("failed")
          expect(result[:error]).to include("Unexpected error")
        end

        it "updates domain to failed" do
          service = described_class.new(domain)
          service.verify

          domain.reload
          expect(domain.dns_verification_status).to eq("failed")
          expect(domain.dns_error_message).to include("Unexpected error")
        end
      end

      context "when CNAME has trailing dot" do
        before do
          allow_any_instance_of(described_class).to receive(:lookup_cname)
            .with("www.mybusiness.com")
            .and_return("cname.launch10.com.")
        end

        it "treats it as verified (handles DNS trailing dot)" do
          service = described_class.new(domain)
          result = service.verify

          expect(result[:status]).to eq("verified")
        end
      end

      context "when CNAME has different case" do
        before do
          allow_any_instance_of(described_class).to receive(:lookup_cname)
            .with("www.mybusiness.com")
            .and_return("CNAME.LAUNCH10.AI")
        end

        it "treats it as verified (case insensitive)" do
          service = described_class.new(domain)
          result = service.verify

          expect(result[:status]).to eq("verified")
        end
      end
    end
  end

  describe "EXPECTED_CNAME constant" do
    it "is set to cname.launch10.com" do
      expect(described_class::EXPECTED_CNAME).to eq("cname.launch10.com")
    end
  end
end
