# == Schema Information
#
# Table name: domains
#
#  id                    :bigint           not null, primary key
#  domain                :string
#  is_platform_subdomain :boolean          default(FALSE), not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  account_id            :bigint
#  cloudflare_zone_id    :string
#  website_id            :bigint
#
# Indexes
#
#  index_domains_on_account_id                         (account_id)
#  index_domains_on_account_id_and_platform_subdomain  (account_id,is_platform_subdomain)
#  index_domains_on_cloudflare_zone_id                 (cloudflare_zone_id)
#  index_domains_on_created_at                         (created_at)
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
      subscribe_account(account, plan_name: 'starter')
      create_plan_limit(account.plan, 'platform_subdomains', 3)
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
end
