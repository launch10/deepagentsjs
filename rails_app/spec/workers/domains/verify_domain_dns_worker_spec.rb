# frozen_string_literal: true

require "rails_helper"

RSpec.describe Domains::VerifyDomainDnsWorker do
  let(:worker) { described_class.new }
  let(:account) { create(:account) }

  describe "#perform" do
    context "with a valid unverified domain" do
      let!(:domain) do
        create(:domain,
          domain: "www.mybusiness.com",
          account: account,
          is_platform_subdomain: false,
          dns_verification_status: "pending")
      end

      context "when DNS is correctly configured" do
        before do
          allow_any_instance_of(Domains::DnsVerificationService)
            .to receive(:lookup_cname)
            .and_return("cname.launch10.ai")
        end

        it "updates domain to verified" do
          worker.perform(domain.id)

          domain.reload
          expect(domain.dns_verification_status).to eq("verified")
        end

        it "updates dns_last_checked_at" do
          worker.perform(domain.id)

          expect(domain.reload.dns_last_checked_at).to be_present
          expect(domain.dns_last_checked_at).to be_within(1.second).of(Time.current)
        end

        it "logs success" do
          expect(Rails.logger).to receive(:info).with(/DNS verified successfully/)

          worker.perform(domain.id)
        end
      end

      context "when DNS is not configured" do
        before do
          allow_any_instance_of(Domains::DnsVerificationService)
            .to receive(:lookup_cname)
            .and_return(nil)
        end

        it "updates domain to pending" do
          worker.perform(domain.id)

          domain.reload
          expect(domain.dns_verification_status).to eq("pending")
        end

        it "updates dns_last_checked_at" do
          worker.perform(domain.id)

          expect(domain.reload.dns_last_checked_at).to be_present
        end

        it "sets error message" do
          worker.perform(domain.id)

          expect(domain.reload.dns_error_message).to include("CNAME not configured")
        end

        it "logs pending status" do
          expect(Rails.logger).to receive(:info).with(/DNS pending/)

          worker.perform(domain.id)
        end
      end

      context "when DNS lookup fails" do
        before do
          allow_any_instance_of(Domains::DnsVerificationService)
            .to receive(:lookup_cname)
            .and_raise(StandardError.new("Network timeout"))
        end

        it "updates domain to failed" do
          worker.perform(domain.id)

          domain.reload
          expect(domain.dns_verification_status).to eq("failed")
        end

        it "sets error message" do
          worker.perform(domain.id)

          expect(domain.reload.dns_error_message).to include("Network timeout")
        end

        it "logs failure" do
          expect(Rails.logger).to receive(:warn).with(/DNS verification failed/)

          worker.perform(domain.id)
        end
      end
    end

    context "when domain does not exist" do
      it "handles gracefully and logs a warning" do
        expect(Rails.logger).to receive(:warn).with(/Domain 99999 not found/)

        expect { worker.perform(99999) }.not_to raise_error
      end

      it "does not raise an error" do
        expect { worker.perform(99999) }.not_to raise_error
      end
    end

    context "when domain was already verified" do
      let!(:domain) do
        create(:domain,
          domain: "www.mybusiness.com",
          account: account,
          is_platform_subdomain: false,
          dns_verification_status: "verified")
      end

      it "skips verification" do
        expect(Domains::DnsVerificationService).not_to receive(:new)

        worker.perform(domain.id)
      end

      it "does not change domain status" do
        expect {
          worker.perform(domain.id)
        }.not_to change { domain.reload.dns_verification_status }
      end
    end

    context "when domain is a platform subdomain" do
      let!(:domain) do
        create(:domain,
          domain: "mysite.launch10.site",
          account: account,
          is_platform_subdomain: true)
      end

      it "skips verification" do
        expect(Domains::DnsVerificationService).not_to receive(:new)

        worker.perform(domain.id)
      end

      it "does not change domain" do
        expect {
          worker.perform(domain.id)
        }.not_to change { domain.reload.updated_at }
      end
    end

    context "race condition: domain deleted after being queued" do
      let!(:domain) do
        create(:domain,
          domain: "www.mybusiness.com",
          account: account,
          is_platform_subdomain: false,
          dns_verification_status: "pending")
      end

      it "handles gracefully when domain is deleted before job runs" do
        domain_id = domain.id
        domain.release!

        expect { worker.perform(domain_id) }.not_to raise_error
      end
    end

    context "race condition: domain verified after being queued" do
      let!(:domain) do
        create(:domain,
          domain: "www.mybusiness.com",
          account: account,
          is_platform_subdomain: false,
          dns_verification_status: "pending")
      end

      it "skips verification if domain was verified since being queued" do
        domain.update!(dns_verification_status: "verified")

        expect(Domains::DnsVerificationService).not_to receive(:new)

        worker.perform(domain.id)
      end
    end

    context "retry behavior" do
      it "is configured with 3 retries" do
        expect(described_class.sidekiq_options["retry"]).to eq(3)
      end

      it "uses the default queue" do
        expect(described_class.sidekiq_options["queue"]).to eq(:default)
      end
    end
  end

  describe "idempotency" do
    let!(:domain) do
      create(:domain,
        domain: "www.mybusiness.com",
        account: account,
        is_platform_subdomain: false,
        dns_verification_status: "pending")
    end

    before do
      allow_any_instance_of(Domains::DnsVerificationService)
        .to receive(:lookup_cname)
        .and_return("cname.launch10.ai")
    end

    it "can be safely run multiple times" do
      worker.perform(domain.id)
      worker.perform(domain.id)
      worker.perform(domain.id)

      domain.reload
      expect(domain.dns_verification_status).to eq("verified")
    end
  end
end
