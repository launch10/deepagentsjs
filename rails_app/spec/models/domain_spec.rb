# == Schema Information
#
# Table name: domains
#
#  id                 :bigint           not null, primary key
#  domain             :string
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint
#  cloudflare_zone_id :string
#  website_id         :bigint
#
# Indexes
#
#  index_domains_on_account_id          (account_id)
#  index_domains_on_cloudflare_zone_id  (cloudflare_zone_id)
#  index_domains_on_created_at          (created_at)
#  index_domains_on_domain              (domain)
#  index_domains_on_website_id          (website_id)
#

require 'rails_helper'

RSpec.describe Domain, type: :model do
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

        it 'falls back to launch10.ai when env var not set' do
          ENV.delete('DEPLOYMENT_BASE_URL')
          domain = Domain.new(website: website, account: account)
          domain.save
          expect(domain.domain).to eq('test-site.launch10.ai')
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
