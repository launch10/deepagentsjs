# frozen_string_literal: true

require "rails_helper"

RSpec.describe Domains::ReleaseStaleDomainsWorker do
  include ActiveSupport::Testing::TimeHelpers

  let(:worker) { described_class.new }

  describe "#perform" do
    let(:account) { create(:account) }

    context "with stale unverified custom domains" do
      it "enqueues ReleaseDomainWorker for each stale domain" do
        stale_domain = travel_to(8.days.ago) do
          create(:domain, domain: "www.stale.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending")
        end

        expect(Domains::ReleaseDomainWorker).to receive(:perform_async).with(stale_domain.id)

        worker.perform
      end

      it "enqueues workers for multiple stale domains" do
        stale_domains = travel_to(10.days.ago) do
          [
            create(:domain, domain: "www.stale1.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending"),
            create(:domain, domain: "www.stale2.com", account: account, is_platform_subdomain: false, dns_verification_status: "failed"),
            create(:domain, domain: "www.stale3.com", account: account, is_platform_subdomain: false, dns_verification_status: nil)
          ]
        end

        stale_domains.each do |domain|
          expect(Domains::ReleaseDomainWorker).to receive(:perform_async).with(domain.id)
        end

        worker.perform
      end
    end

    context "with domains that should not be released" do
      it "does not enqueue workers for verified custom domains" do
        travel_to(8.days.ago) do
          create(:domain, domain: "www.verified.com", account: account, is_platform_subdomain: false, dns_verification_status: "verified")
        end

        expect(Domains::ReleaseDomainWorker).not_to receive(:perform_async)

        worker.perform
      end

      it "does not enqueue workers for recently created unverified domains" do
        create(:domain, domain: "www.recent.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending")

        expect(Domains::ReleaseDomainWorker).not_to receive(:perform_async)

        worker.perform
      end

      it "does not enqueue workers for platform subdomains regardless of age" do
        travel_to(30.days.ago) do
          create(:domain, domain: "old.launch10.site", account: account, is_platform_subdomain: true)
        end

        expect(Domains::ReleaseDomainWorker).not_to receive(:perform_async)

        worker.perform
      end
    end

    context "with multiple accounts" do
      it "enqueues workers for stale domains across all accounts" do
        account2 = create(:account)

        stale1 = travel_to(8.days.ago) do
          create(:domain, domain: "www.stale1.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending")
        end

        stale2 = travel_to(8.days.ago) do
          create(:domain, domain: "www.stale2.com", account: account2, is_platform_subdomain: false, dns_verification_status: "pending")
        end

        expect(Domains::ReleaseDomainWorker).to receive(:perform_async).with(stale1.id)
        expect(Domains::ReleaseDomainWorker).to receive(:perform_async).with(stale2.id)

        worker.perform
      end
    end

    context "integration test with inline Sidekiq" do
      around do |example|
        Sidekiq::Testing.inline! do
          example.run
        end
      end

      it "releases stale domains end-to-end" do
        stale_domain = travel_to(8.days.ago) do
          create(:domain, domain: "www.stale.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending")
        end

        expect {
          worker.perform
        }.to change { Domain.with_deleted.count }.by(-1)

        expect(Domain.with_deleted.find_by(id: stale_domain.id)).to be_nil
      end
    end
  end
end
