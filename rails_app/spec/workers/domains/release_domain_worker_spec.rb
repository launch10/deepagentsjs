# frozen_string_literal: true

require "rails_helper"

RSpec.describe Domains::ReleaseDomainWorker do
  let(:worker) { described_class.new }
  let(:account) { create(:account) }

  describe "#perform" do
    context "with a valid domain" do
      let!(:domain) { create(:domain, domain: "www.stale.com", account: account, is_platform_subdomain: false) }

      it "hard deletes the domain from the database" do
        domain_id = domain.id

        worker.perform(domain_id)

        expect(Domain.with_deleted.find_by(id: domain_id)).to be_nil
      end

      it "logs the release" do
        expect(Rails.logger).to receive(:info).with(/Releasing domain: www.stale.com/)

        worker.perform(domain.id)
      end
    end

    context "with associated website_urls" do
      let(:project) { create(:project, account: account) }
      let(:website) { create(:website, project: project, account: account) }
      let!(:domain) { create(:domain, domain: "www.stale.com", account: account, website: website) }
      let!(:website_url) { create(:website_url, domain: domain, website: website, account: account, path: "/landing") }

      it "destroys associated website_urls" do
        url_id = website_url.id

        worker.perform(domain.id)

        expect(WebsiteUrl.find_by(id: url_id)).to be_nil
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

    context "when domain was already released" do
      let!(:domain) { create(:domain, domain: "www.stale.com", account: account) }

      it "handles idempotently" do
        domain_id = domain.id
        domain.release!

        expect { worker.perform(domain_id) }.not_to raise_error
      end
    end

    context "race condition: domain verified after being queued" do
      let!(:domain) { create(:domain, domain: "www.stale.com", account: account, is_platform_subdomain: false, dns_verification_status: "pending") }

      it "does not release if DNS was verified since being queued" do
        # Simulate DNS being verified after the coordinator queued this job
        domain.update!(dns_verification_status: "verified")

        expect {
          worker.perform(domain.id)
        }.not_to change { Domain.with_deleted.count }

        expect(Domain.find(domain.id)).to be_present
      end

      it "logs that the domain was verified" do
        domain.update!(dns_verification_status: "verified")

        expect(Rails.logger).to receive(:info).with(/was verified since being queued/)

        worker.perform(domain.id)
      end
    end

    context "defensive check: platform subdomain accidentally queued" do
      let!(:domain) { create(:domain, domain: "mysite.launch10.site", account: account, is_platform_subdomain: true) }

      it "does not release platform subdomains" do
        expect {
          worker.perform(domain.id)
        }.not_to change { Domain.with_deleted.count }

        expect(Domain.find(domain.id)).to be_present
      end

      it "logs a warning" do
        expect(Rails.logger).to receive(:warn).with(/is a platform subdomain/)

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
end
