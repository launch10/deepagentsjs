# frozen_string_literal: true

require "rails_helper"

RSpec.describe Domains::DnsVerificationBatchWorker do
  include ActiveSupport::Testing::TimeHelpers

  let(:worker) { described_class.new }
  let(:account) { create(:account) }

  describe "#perform" do
    context "with custom domains needing verification" do
      it "enqueues VerifyDomainDnsWorker for unverified custom domains" do
        domain = create(:domain, domain: "www.mybusiness.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending")

        expect(Domains::VerifyDomainDnsWorker).to receive(:perform_async).with(domain.id)

        worker.perform
      end

      it "enqueues workers for domains with nil verification status" do
        domain = create(:domain, domain: "www.mybusiness.com", account: account, is_platform_subdomain: false, dns_verification_status: nil)

        expect(Domains::VerifyDomainDnsWorker).to receive(:perform_async).with(domain.id)

        worker.perform
      end

      it "enqueues workers for domains with failed verification status" do
        domain = create(:domain, domain: "www.mybusiness.com", account: account, is_platform_subdomain: false, dns_verification_status: "failed")

        expect(Domains::VerifyDomainDnsWorker).to receive(:perform_async).with(domain.id)

        worker.perform
      end

      it "enqueues workers for multiple domains" do
        domains = [
          create(:domain, domain: "www.business1.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending"),
          create(:domain, domain: "www.business2.com", account: account, is_platform_subdomain: false, dns_verification_status: nil),
          create(:domain, domain: "www.business3.com", account: account, is_platform_subdomain: false, dns_verification_status: "failed")
        ]

        domains.each do |domain|
          expect(Domains::VerifyDomainDnsWorker).to receive(:perform_async).with(domain.id)
        end

        worker.perform
      end
    end

    context "scoping: excludes verified domains" do
      it "does not enqueue workers for verified domains" do
        create(:domain, domain: "www.verified.com", account: account, is_platform_subdomain: false, dns_verification_status: "verified")

        expect(Domains::VerifyDomainDnsWorker).not_to receive(:perform_async)

        worker.perform
      end
    end

    context "scoping: excludes platform subdomains" do
      it "does not enqueue workers for platform subdomains" do
        create(:domain, domain: "mysite.launch10.site", account: account, is_platform_subdomain: true, dns_verification_status: nil)

        expect(Domains::VerifyDomainDnsWorker).not_to receive(:perform_async)

        worker.perform
      end
    end

    context "scoping: excludes domains older than grace period" do
      it "does not enqueue workers for domains created more than 7 days ago" do
        travel_to(8.days.ago) do
          create(:domain, domain: "www.old.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending")
        end

        expect(Domains::VerifyDomainDnsWorker).not_to receive(:perform_async)

        worker.perform
      end

      it "enqueues workers for domains created within 7 days" do
        # Create domain 6 days ago (within grace period)
        domain = travel_to(6.days.ago) do
          create(:domain, domain: "www.borderline.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending")
        end

        expect(Domains::VerifyDomainDnsWorker).to receive(:perform_async).with(domain.id)

        worker.perform
      end

      it "enqueues workers for recently created domains" do
        domain = travel_to(1.day.ago) do
          create(:domain, domain: "www.recent.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending")
        end

        expect(Domains::VerifyDomainDnsWorker).to receive(:perform_async).with(domain.id)

        worker.perform
      end
    end

    context "scoping: excludes recently checked domains" do
      it "does not enqueue workers for domains checked within the last hour" do
        create(:domain,
          domain: "www.recent-check.com",
          account: account,
          is_platform_subdomain: false,
          dns_verification_status: "pending",
          dns_last_checked_at: 30.minutes.ago)

        expect(Domains::VerifyDomainDnsWorker).not_to receive(:perform_async)

        worker.perform
      end

      it "enqueues workers for domains checked more than 1 hour ago" do
        domain = create(:domain,
          domain: "www.stale-check.com",
          account: account,
          is_platform_subdomain: false,
          dns_verification_status: "pending",
          dns_last_checked_at: 2.hours.ago)

        expect(Domains::VerifyDomainDnsWorker).to receive(:perform_async).with(domain.id)

        worker.perform
      end

      it "enqueues workers for domains never checked (dns_last_checked_at is NULL)" do
        domain = create(:domain,
          domain: "www.never-checked.com",
          account: account,
          is_platform_subdomain: false,
          dns_verification_status: "pending",
          dns_last_checked_at: nil)

        expect(Domains::VerifyDomainDnsWorker).to receive(:perform_async).with(domain.id)

        worker.perform
      end
    end

    context "with multiple accounts" do
      it "enqueues workers for domains across all accounts" do
        account2 = create(:account)

        domain1 = create(:domain, domain: "www.business1.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending")
        domain2 = create(:domain, domain: "www.business2.com", account: account2, is_platform_subdomain: false, dns_verification_status: "pending")

        expect(Domains::VerifyDomainDnsWorker).to receive(:perform_async).with(domain1.id)
        expect(Domains::VerifyDomainDnsWorker).to receive(:perform_async).with(domain2.id)

        worker.perform
      end
    end

    context "combined scoping criteria" do
      it "only enqueues eligible domains when mixed set exists" do
        # Should be enqueued: recent, unverified, custom domain, not recently checked
        eligible_domain = create(:domain,
          domain: "www.eligible.com",
          account: account,
          is_platform_subdomain: false,
          dns_verification_status: "pending",
          dns_last_checked_at: 2.hours.ago)

        # Should NOT be enqueued: verified
        create(:domain, domain: "www.verified.com", account: account, is_platform_subdomain: false, dns_verification_status: "verified")

        # Should NOT be enqueued: platform subdomain
        create(:domain, domain: "mysite.launch10.site", account: account, is_platform_subdomain: true)

        # Should NOT be enqueued: too old
        travel_to(8.days.ago) do
          create(:domain, domain: "www.old.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending")
        end

        # Should NOT be enqueued: recently checked
        create(:domain, domain: "www.recent-check.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending", dns_last_checked_at: 30.minutes.ago)

        expect(Domains::VerifyDomainDnsWorker).to receive(:perform_async).once.with(eligible_domain.id)

        worker.perform
      end
    end

    context "integration test with inline Sidekiq" do
      around do |example|
        Sidekiq::Testing.inline! do
          example.run
        end
      end

      it "verifies DNS end-to-end" do
        domain = create(:domain,
          domain: "www.mybusiness.com",
          account: account,
          is_platform_subdomain: false,
          dns_verification_status: nil,
          dns_last_checked_at: nil)

        # Mock successful DNS verification
        allow_any_instance_of(Domains::DnsVerificationService)
          .to receive(:lookup_cname)
          .and_return("cname.launch10.ai")

        expect {
          worker.perform
        }.to change { domain.reload.dns_verification_status }.from(nil).to("verified")

        expect(domain.dns_last_checked_at).to be_present
      end

      it "updates dns_last_checked_at even on pending result" do
        domain = create(:domain,
          domain: "www.mybusiness.com",
          account: account,
          is_platform_subdomain: false,
          dns_verification_status: nil,
          dns_last_checked_at: nil)

        # Mock DNS not configured
        allow_any_instance_of(Domains::DnsVerificationService)
          .to receive(:lookup_cname)
          .and_return(nil)

        worker.perform

        domain.reload
        expect(domain.dns_verification_status).to eq("pending")
        expect(domain.dns_last_checked_at).to be_present
      end
    end

    context "configuration" do
      it "uses the default queue" do
        expect(described_class.sidekiq_options["queue"]).to eq(:default)
      end
    end
  end

  describe "constants" do
    it "has CHECK_INTERVAL of 1 hour" do
      expect(described_class::CHECK_INTERVAL).to eq(1.hour)
    end

    it "has GRACE_PERIOD_DAYS of 7" do
      expect(described_class::GRACE_PERIOD_DAYS).to eq(7)
    end
  end
end
