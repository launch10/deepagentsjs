# == Schema Information
#
# Table name: domains
#
#  id                      :bigint           not null, primary key
#  deleted_at              :datetime
#  dns_error_message       :string
#  dns_last_checked_at     :datetime
#  dns_verification_status :string
#  domain                  :string
#  is_platform_subdomain   :boolean          default(FALSE), not null
#  created_at              :datetime         not null
#  updated_at              :datetime         not null
#  account_id              :bigint
#  cloudflare_zone_id      :string
#  website_id              :bigint
#
# Indexes
#
#  index_domains_on_account_id                         (account_id)
#  index_domains_on_account_id_and_platform_subdomain  (account_id,is_platform_subdomain)
#  index_domains_on_cloudflare_zone_id                 (cloudflare_zone_id)
#  index_domains_on_created_at                         (created_at)
#  index_domains_on_deleted_at                         (deleted_at)
#  index_domains_on_dns_last_checked_at                (dns_last_checked_at)
#  index_domains_on_dns_verification_status            (dns_verification_status)
#  index_domains_on_domain                             (domain)
#  index_domains_on_website_id                         (website_id)
#

require 'rails_helper'

RSpec.describe Domain, type: :model do
  include SubscriptionHelpers
  include PlanHelpers

  describe 'validations' do
    let(:user) { create(:user) }
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }
    let(:website) { create(:website, project: project, account: account) }

    it 'validates presence of domain' do
      domain = Domain.new(website: website, account: account)
      # Skip callback to test validation directly
      domain.instance_eval {
        def set_default_domain
        end
      }
      expect(domain).not_to be_valid
      expect(domain.errors[:domain]).to include("can't be blank")
    end

    it 'validates uniqueness of domain' do
      create(:domain, domain: 'test.com', website: website, account: account)
      duplicate = Domain.new(domain: 'test.com', website: website, account: account)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:domain]).to include('has already been taken')
    end

    it "validates not restricted" do
      domain = Domain.new(domain: 'uploads.launch10.ai', website: website, account: account)
      expect(domain).not_to be_valid
      expect(domain.errors[:domain]).to include('is restricted')

      domain = Domain.new(domain: 'launch10.ai', website: website, account: account)
      expect(domain).not_to be_valid

      domain = Domain.new(domain: 'www.launch10.ai', website: website, account: account)
      expect(domain).not_to be_valid
    end

    it 'allows website_id to be optional' do
      domain = Domain.new(domain: 'test.com', account: account)
      expect(domain).to be_valid
    end

    it 'validates presence of account_id' do
      domain = Domain.new(domain: 'test.com', website: website)
      expect(domain).not_to be_valid
      expect(domain.errors[:account_id]).to include("can't be blank")
    end
  end

  describe 'callbacks' do
    describe '#set_default_domain' do
      let(:user) { create(:user) }
      let(:account) { create(:account) }
      let(:project) { create(:project, account: account) }
      let(:website) { create(:website, name: 'Test Site', project: project, account: account) }

      before do
        ENV['DEPLOYMENT_BASE_URL'] = 'test-deploy.com'
      end

      after do
        ENV.delete('DEPLOYMENT_BASE_URL')
      end

      context 'when domain is not provided' do
        it 'sets the default domain based on website name and env variable' do
          domain = Domain.new(website: website, account: account)
          domain.save
          expect(domain.domain).to eq('test-site.test-deploy.com')
        end

        it 'falls back to launch10.site when env var not set' do
          ENV.delete('DEPLOYMENT_BASE_URL')
          domain = Domain.new(website: website, account: account)
          domain.save
          expect(domain.domain).to eq('test-site.launch10.site')
        end

        context 'when the default domain is already taken' do
          before do
            create(:domain, domain: 'test-site.test-deploy.com', website: website, account: account)
          end

          it 'increments the domain with a number' do
            new_website = create(:website, name: 'Test Site', project: project, account: account)
            domain = Domain.new(website: new_website, account: account)
            domain.save
            expect(domain.domain).to eq('test-site1.test-deploy.com')
          end

          it 'finds the next available number' do
            create(:domain, domain: 'test-site1.test-deploy.com', website: website, account: account)
            new_website = create(:website, name: 'Test Site', project: project, account: account)
            domain = Domain.new(website: new_website, account: account)
            domain.save
            expect(domain.domain).to eq('test-site2.test-deploy.com')
          end
        end
      end

      context 'when domain is provided' do
        it 'normalizes the provided domain by adding www' do
          domain = Domain.new(domain: 'custom-domain.com', website: website, account: account)
          domain.save
          expect(domain.domain).to eq('www.custom-domain.com')
        end

        it 'keeps domain with subdomain as-is' do
          domain = Domain.new(domain: 'subdomain.custom-domain.com', website: website, account: account)
          domain.save
          expect(domain.domain).to eq('subdomain.custom-domain.com')
        end
      end

      context 'when website is nil' do
        it 'does not set a default domain' do
          domain = Domain.new(account: account)
          domain.valid?
          expect(domain.domain).to be_nil
        end
      end
    end
  end

  describe 'domain uniqueness' do
    let(:user) { create(:user) }
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }
    let(:website) { create(:website, project: project, account: account) }

    it 'prevents duplicate domains' do
      create(:domain, domain: 'unique-domain.com', website: website, account: account)
      duplicate = build(:domain, domain: 'unique-domain.com', website: website, account: account)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:domain]).to include('has already been taken')
    end

    it 'allows different domains for the same website' do
      create(:domain, domain: 'first-domain.com', website: website, account: account)
      domain2 = build(:domain, domain: 'second-domain.com', website: website, account: account)
      expect(domain2).to be_valid
    end
  end

  describe 'cloudflare_zone_id' do
    let(:user) { create(:user) }
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }
    let(:website) { create(:website, project: project, account: account) }

    it 'can store cloudflare zone id' do
      domain = create(:domain,
        website: website,
        account: account,
        cloudflare_zone_id: 'cf_zone_123')
      expect(domain.cloudflare_zone_id).to eq('cf_zone_123')
    end

    it 'is optional' do
      domain = build(:domain, website: website, account: account, cloudflare_zone_id: nil)
      expect(domain).to be_valid
    end
  end

  describe 'is_platform_subdomain' do
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }
    let(:website) { create(:website, project: project, account: account) }

    it 'auto-sets to true for launch10.site subdomains' do
      domain = create(:domain, domain: 'mysite.launch10.site', website: website, account: account)
      expect(domain.is_platform_subdomain).to eq(true)
    end

    it 'auto-sets to false for non-launch10.site domains' do
      domain = create(:domain, domain: 'custom.com', website: website, account: account)
      expect(domain.is_platform_subdomain).to eq(false)
    end

    it 'auto-sets to true for nested launch10.site subdomains' do
      domain = create(:domain, domain: 'sub.mysite.launch10.site', website: website, account: account)
      expect(domain.is_platform_subdomain).to eq(true)
    end

    it 'does not auto-set for domains that only contain launch10.site as a substring' do
      domain = create(:domain, domain: 'launch10.site.example.com', website: website, account: account)
      expect(domain.is_platform_subdomain).to eq(false)
    end

    describe '#platform_subdomain?' do
      it 'returns true when is_platform_subdomain is true' do
        domain = build(:domain, is_platform_subdomain: true, account: account)
        expect(domain.platform_subdomain?).to eq(true)
      end

      it 'returns false when is_platform_subdomain is false' do
        domain = build(:domain, is_platform_subdomain: false, account: account)
        expect(domain.platform_subdomain?).to eq(false)
      end
    end
  end

  describe 'subdomain limit validation' do
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }
    let(:website) { create(:website, project: project, account: account) }

    before do
      ensure_plans_exist
      subscribe_account(account, plan_name: "starter_monthly")
      create_plan_limit(account.plan, "platform_subdomains", 3)
    end

    context 'when under subdomain limit' do
      it 'allows creating launch10 subdomains' do
        domain = build(:domain, domain: 'site1.launch10.site', website: website, account: account, is_platform_subdomain: true)
        expect(domain).to be_valid
      end

      it 'allows creating multiple launch10 subdomains up to the limit' do
        create(:domain, domain: 'site1.launch10.site', website: website, account: account, is_platform_subdomain: true)
        create(:domain, domain: 'site2.launch10.site', website: website, account: account, is_platform_subdomain: true)
        domain3 = build(:domain, domain: 'site3.launch10.site', website: website, account: account, is_platform_subdomain: true)
        expect(domain3).to be_valid
      end
    end

    context 'when at subdomain limit' do
      before do
        3.times do |i|
          create(:domain, domain: "site#{i}.launch10.site", account: account, is_platform_subdomain: true)
        end
      end

      it 'prevents creating additional launch10 subdomains' do
        domain = build(:domain, domain: 'site4.launch10.site', website: website, account: account, is_platform_subdomain: true)
        expect(domain).not_to be_valid
        expect(domain.errors[:base]).to include('You have reached the maximum number of platform subdomains for your plan')
      end

      it 'still allows creating custom domains (non-platform subdomains)' do
        domain = build(:domain, domain: 'mycustom.com', website: website, account: account, is_platform_subdomain: false)
        expect(domain).to be_valid
      end
    end

    context 'when updating existing subdomain' do
      it 'does not count the current record against the limit' do
        create(:domain, domain: 'site1.launch10.site', account: account, is_platform_subdomain: true)
        create(:domain, domain: 'site2.launch10.site', account: account, is_platform_subdomain: true)
        domain3 = create(:domain, domain: 'site3.launch10.site', account: account, is_platform_subdomain: true)

        domain3.cloudflare_zone_id = 'new_zone_id'
        expect(domain3).to be_valid
      end
    end
  end

  describe '.platform_subdomains scope' do
    let(:account) { create(:account) }

    before do
      create(:domain, domain: 'site1.launch10.site', account: account, is_platform_subdomain: true)
      create(:domain, domain: 'site2.launch10.site', account: account, is_platform_subdomain: true)
      create(:domain, domain: 'custom.com', account: account, is_platform_subdomain: false)
    end

    it 'returns only launch10 subdomains' do
      expect(account.domains.platform_subdomains.count).to eq(2)
    end
  end

  describe 'parameterization' do
    let(:user) { create(:user) }
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }

    before do
      ENV['DEPLOYMENT_BASE_URL'] = 'test-deploy.com'
    end

    after do
      ENV.delete('DEPLOYMENT_BASE_URL')
    end

    it 'properly parameterizes website names with spaces' do
      website = create(:website, name: 'My Awesome Site', project: project, account: account)
      domain = Domain.create(website: website, account: account)
      expect(domain.domain).to eq('my-awesome-site.test-deploy.com')
    end

    it 'properly parameterizes website names with special characters' do
      website = create(:website, name: 'Site@123!', project: project, account: account)
      domain = Domain.create(website: website, account: account)
      expect(domain.domain).to eq('site-123.test-deploy.com')
    end

    it 'handles empty strings after parameterization' do
      website = create(:website, name: '@#$%', project: project, account: account)
      domain = Domain.create(website: website, account: account)
      expect(domain.domain).to eq('.test-deploy.com')
    end
  end

  describe 'dns_verification_status' do
    let(:account) { create(:account) }

    describe 'validations' do
      it 'allows nil status' do
        domain = build(:domain, domain: 'test.launch10.site', account: account, dns_verification_status: nil)
        expect(domain).to be_valid
      end

      it 'allows pending status' do
        domain = build(:domain, domain: 'test.launch10.site', account: account, dns_verification_status: 'pending')
        expect(domain).to be_valid
      end

      it 'allows verified status' do
        domain = build(:domain, domain: 'test.launch10.site', account: account, dns_verification_status: 'verified')
        expect(domain).to be_valid
      end

      it 'allows failed status' do
        domain = build(:domain, domain: 'test.launch10.site', account: account, dns_verification_status: 'failed')
        expect(domain).to be_valid
      end

      it 'rejects invalid status values' do
        domain = build(:domain, domain: 'test.launch10.site', account: account, dns_verification_status: 'invalid')
        expect(domain).not_to be_valid
        expect(domain.errors[:dns_verification_status]).to include('is not included in the list')
      end
    end

    describe '#requires_dns_verification?' do
      it 'returns false for platform subdomains' do
        domain = build(:domain, domain: 'test.launch10.site', account: account, is_platform_subdomain: true, dns_verification_status: nil)
        expect(domain.requires_dns_verification?).to eq(false)
      end

      it 'returns true for custom domains without verification' do
        domain = build(:domain, domain: 'custom.com', account: account, is_platform_subdomain: false, dns_verification_status: nil)
        expect(domain.requires_dns_verification?).to eq(true)
      end

      it 'returns true for custom domains with pending status' do
        domain = build(:domain, domain: 'custom.com', account: account, is_platform_subdomain: false, dns_verification_status: 'pending')
        expect(domain.requires_dns_verification?).to eq(true)
      end

      it 'returns false for custom domains that are verified' do
        domain = build(:domain, domain: 'custom.com', account: account, is_platform_subdomain: false, dns_verification_status: 'verified')
        expect(domain.requires_dns_verification?).to eq(false)
      end
    end

    describe '#dns_verified?' do
      it 'returns false when status is nil' do
        domain = build(:domain, account: account, dns_verification_status: nil)
        expect(domain.dns_verified?).to eq(false)
      end

      it 'returns false when status is pending' do
        domain = build(:domain, account: account, dns_verification_status: 'pending')
        expect(domain.dns_verified?).to eq(false)
      end

      it 'returns true when status is verified' do
        domain = build(:domain, account: account, dns_verification_status: 'verified')
        expect(domain.dns_verified?).to eq(true)
      end

      it 'returns false when status is failed' do
        domain = build(:domain, account: account, dns_verification_status: 'failed')
        expect(domain.dns_verified?).to eq(false)
      end
    end
  end

  describe '.unverified_custom_domains' do
    let(:account) { create(:account) }

    before do
      # Platform subdomains (should NOT be included)
      create(:domain, domain: 'site1.launch10.site', account: account, is_platform_subdomain: true)

      # Custom domains with various verification states
      # Note: Domain model normalizes custom domains by adding www. prefix
      create(:domain, domain: 'www.verified.com', account: account, is_platform_subdomain: false, dns_verification_status: 'verified')
      create(:domain, domain: 'www.pending.com', account: account, is_platform_subdomain: false, dns_verification_status: 'pending')
      create(:domain, domain: 'www.failed.com', account: account, is_platform_subdomain: false, dns_verification_status: 'failed')
      create(:domain, domain: 'www.unset.com', account: account, is_platform_subdomain: false, dns_verification_status: nil)
    end

    it 'returns only custom domains that are not verified' do
      unverified = account.domains.unverified_custom_domains
      expect(unverified.pluck(:domain)).to contain_exactly('www.pending.com', 'www.failed.com', 'www.unset.com')
    end

    it 'excludes platform subdomains' do
      unverified = account.domains.unverified_custom_domains
      expect(unverified.pluck(:domain)).not_to include('site1.launch10.site')
    end

    it 'excludes verified custom domains' do
      unverified = account.domains.unverified_custom_domains
      expect(unverified.pluck(:domain)).not_to include('www.verified.com')
    end
  end

  describe '#to_api_json' do
    let(:account) { create(:account) }
    let(:domain) { create(:domain, domain: 'test.launch10.site', account: account, is_platform_subdomain: true) }

    it 'includes dns_verification_status field' do
      domain.update!(dns_verification_status: 'verified')
      json = domain.to_api_json

      expect(json).to have_key(:dns_verification_status)
      expect(json[:dns_verification_status]).to eq('verified')
    end

    it 'includes dns_last_checked_at field as ISO8601' do
      checked_time = Time.current
      domain.update!(dns_last_checked_at: checked_time)
      json = domain.to_api_json

      expect(json).to have_key(:dns_last_checked_at)
      expect(json[:dns_last_checked_at]).to eq(checked_time.iso8601)
    end

    it 'includes dns_error_message field' do
      domain.update!(dns_error_message: 'CNAME not configured')
      json = domain.to_api_json

      expect(json).to have_key(:dns_error_message)
      expect(json[:dns_error_message]).to eq('CNAME not configured')
    end

    it 'handles nil dns_last_checked_at' do
      json = domain.to_api_json
      expect(json[:dns_last_checked_at]).to be_nil
    end
  end

  describe '#release!' do
    let(:account) { create(:account) }

    describe 'for platform subdomains' do
      let!(:domain) { create(:domain, domain: 'mysite.launch10.site', account: account, is_platform_subdomain: true) }

      it 'hard deletes the domain from the database' do
        domain_id = domain.id

        domain.release!

        # Should not exist even with paranoid queries
        expect(Domain.with_deleted.find_by(id: domain_id)).to be_nil
      end

      it 'frees up the subdomain slot for the account' do
        # Start with 1 platform subdomain
        expect(account.domains.platform_subdomains.count).to eq(1)

        domain.release!

        # Count should decrease
        expect(account.domains.platform_subdomains.count).to eq(0)
      end

      it 'allows the same domain to be claimed again by another account' do
        domain_name = domain.domain
        other_account = create(:account)

        domain.release!

        new_domain = Domain.new(domain: domain_name, account: other_account)
        expect(new_domain).to be_valid
        expect { new_domain.save! }.not_to raise_error
      end
    end

    describe 'for custom domains' do
      let!(:domain) { create(:domain, domain: 'www.mycustom.com', account: account, is_platform_subdomain: false) }

      it 'hard deletes the domain from the database' do
        domain_id = domain.id

        domain.release!

        expect(Domain.with_deleted.find_by(id: domain_id)).to be_nil
      end
    end

    describe 'with associated records' do
      let(:project) { create(:project, account: account) }
      let(:website) { create(:website, project: project, account: account) }
      let!(:domain) { create(:domain, domain: 'mysite.launch10.site', account: account, website: website) }
      let!(:website_url) { create(:website_url, domain: domain, website: website, account: account, path: '/landing') }

      it 'destroys associated website_urls' do
        url_id = website_url.id

        domain.release!

        expect(WebsiteUrl.find_by(id: url_id)).to be_nil
      end
    end
  end

  describe '.stale_unverified' do
    include ActiveSupport::Testing::TimeHelpers

    let(:account) { create(:account) }

    it 'returns custom domains created more than 7 days ago with pending/failed/nil DNS status' do
      # Old unverified custom domain (should be included)
      old_pending = travel_to(8.days.ago) do
        create(:domain, domain: 'www.old-pending.com', account: account, is_platform_subdomain: false, dns_verification_status: 'pending')
      end

      old_failed = travel_to(10.days.ago) do
        create(:domain, domain: 'www.old-failed.com', account: account, is_platform_subdomain: false, dns_verification_status: 'failed')
      end

      old_nil = travel_to(14.days.ago) do
        create(:domain, domain: 'www.old-nil.com', account: account, is_platform_subdomain: false, dns_verification_status: nil)
      end

      # Old verified custom domain (should NOT be included)
      old_verified = travel_to(8.days.ago) do
        create(:domain, domain: 'www.old-verified.com', account: account, is_platform_subdomain: false, dns_verification_status: 'verified')
      end

      # Recent unverified custom domain (should NOT be included - within grace period)
      recent_pending = create(:domain, domain: 'www.recent-pending.com', account: account, is_platform_subdomain: false, dns_verification_status: 'pending')

      # Old platform subdomain (should NOT be included - platform subdomains don't need DNS verification)
      old_platform = travel_to(8.days.ago) do
        create(:domain, domain: 'old.launch10.site', account: account, is_platform_subdomain: true)
      end

      stale = Domain.stale_unverified

      expect(stale).to include(old_pending, old_failed, old_nil)
      expect(stale).not_to include(old_verified, recent_pending, old_platform)
    end

    it 'uses configurable grace period' do
      old_domain = travel_to(4.days.ago) do
        create(:domain, domain: 'www.four-days.com', account: account, is_platform_subdomain: false, dns_verification_status: 'pending')
      end

      # With default 7 days, should not be included
      expect(Domain.stale_unverified).not_to include(old_domain)

      # With 3 day grace period, should be included
      expect(Domain.stale_unverified(grace_period_days: 3)).to include(old_domain)
    end
  end
end
