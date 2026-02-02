# == Schema Information
#
# Table name: website_urls
#
#  id         :bigint           not null, primary key
#  deleted_at :datetime
#  path       :string           default("/"), not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint           not null
#  domain_id  :bigint           not null
#  website_id :bigint           not null
#
# Indexes
#
#  index_website_urls_on_account_id          (account_id)
#  index_website_urls_on_deleted_at          (deleted_at)
#  index_website_urls_on_domain_id           (domain_id)
#  index_website_urls_on_domain_id_and_path  (domain_id,path) UNIQUE WHERE (deleted_at IS NULL)
#  index_website_urls_on_website_id          (website_id)
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#  fk_rails_...  (domain_id => domains.id)
#  fk_rails_...  (website_id => websites.id)
#
require 'rails_helper'

RSpec.describe WebsiteUrl, type: :model do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project, account: account) }
  let(:domain) { create(:domain, website: website, account: account) }

  describe 'validations' do
    it 'is valid with required attributes' do
      website_url = build(:website_url, website: website, domain: domain, account: account)
      expect(website_url).to be_valid
    end

    it 'validates presence of domain' do
      website_url = build(:website_url, website: website, domain: nil, account: account)
      expect(website_url).not_to be_valid
      expect(website_url.errors[:domain]).to include("must exist")
    end

    it 'validates presence of website' do
      website_url = build(:website_url, website: nil, domain: domain, account: account)
      expect(website_url).not_to be_valid
      expect(website_url.errors[:website]).to include("must exist")
    end

    it 'validates uniqueness of domain and path combination' do
      create(:website_url, website: website, domain: domain, account: account, path: "/")
      duplicate = build(:website_url, website: website, domain: domain, account: account, path: "/")
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:base]).to include("A website URL with this domain and path already exists")
    end

    it 'allows same domain with different paths' do
      create(:website_url, website: website, domain: domain, account: account, path: "/")
      different_path = build(:website_url, website: website, domain: domain, account: account, path: "/campaign")
      expect(different_path).to be_valid
    end

    it 'allows same path with different domains' do
      other_domain = create(:domain, website: website, account: account)
      create(:website_url, website: website, domain: domain, account: account, path: "/campaign")
      different_domain = build(:website_url, website: website, domain: other_domain, account: account, path: "/campaign")
      expect(different_domain).to be_valid
    end

    it 'validates domain belongs to account' do
      other_account = create(:account)
      other_project = create(:project, account: other_account)
      other_website = create(:website, project: other_project, account: other_account)
      other_domain = create(:domain, website: other_website, account: other_account)

      website_url = build(:website_url, website: website, domain: other_domain, account: account)
      expect(website_url).not_to be_valid
      expect(website_url.errors[:domain]).to include("must belong to the account")
    end

    it 'validates website belongs to account' do
      other_account = create(:account)
      other_project = create(:project, account: other_account)
      other_website = create(:website, project: other_project, account: other_account)

      website_url = build(:website_url, website: other_website, domain: domain, account: account)
      expect(website_url).not_to be_valid
      expect(website_url.errors[:website]).to include("must belong to the account")
    end
  end

  describe 'associations' do
    it 'belongs to website' do
      website_url = create(:website_url, website: website, domain: domain, account: account)
      expect(website_url.website).to eq(website)
    end

    it 'belongs to account' do
      website_url = create(:website_url, website: website, domain: domain, account: account)
      expect(website_url.account).to eq(account)
    end

    it 'belongs to domain' do
      website_url = create(:website_url, website: website, domain: domain, account: account)
      expect(website_url.domain).to eq(domain)
    end
  end

  describe '#domain_string' do
    it 'returns the domain hostname' do
      website_url = create(:website_url, website: website, domain: domain, account: account)
      expect(website_url.domain_string).to eq(domain.domain)
    end
  end

  describe 'callbacks' do
    describe '#set_default_path' do
      it 'defaults path to "/" when not provided' do
        website_url = create(:website_url, website: website, domain: domain, account: account, path: nil)
        expect(website_url.path).to eq("/")
      end

      it 'preserves provided path' do
        website_url = create(:website_url, website: website, domain: domain, account: account, path: "/campaign")
        expect(website_url.path).to eq("/campaign")
      end
    end

    describe '#set_account_from_website' do
      it 'sets account from website when account is not provided' do
        website_url = WebsiteUrl.create!(website: website, domain: domain)
        expect(website_url.account).to eq(website.account)
      end
    end
  end

  describe 'path normalization' do
    it 'adds leading slash when missing' do
      website_url = create(:website_url, website: website, domain: domain, account: account, path: "bingo")
      expect(website_url.path).to eq("/bingo")
    end

    it 'removes trailing slash' do
      website_url = create(:website_url, website: website, domain: domain, account: account, path: "/bingo/")
      expect(website_url.path).to eq("/bingo")
    end

    it 'preserves root path as "/"' do
      website_url = create(:website_url, website: website, domain: domain, account: account, path: "/")
      expect(website_url.path).to eq("/")
    end

    it 'normalizes path without leading slash and with trailing slash' do
      website_url = create(:website_url, website: website, domain: domain, account: account, path: "campaign/")
      expect(website_url.path).to eq("/campaign")
    end
  end

  describe 'single-level path restriction' do
    it 'allows root path' do
      url = create(:website_url, website: website, domain: domain, account: account, path: "/")
      expect(url).to be_valid
    end

    it 'allows single-level paths' do
      url = create(:website_url, website: website, domain: domain, account: account, path: "/bingo")
      expect(url).to be_valid
    end

    it 'rejects multi-level paths' do
      url = build(:website_url, website: website, domain: domain, account: account, path: "/marketing/campaign")
      expect(url).not_to be_valid
      expect(url.errors[:path]).to include("must be single-level (e.g., '/bingo'), multi-level paths like '/marketing/campaign' are not supported")
    end

    it 'rejects deeply nested paths' do
      url = build(:website_url, website: website, domain: domain, account: account, path: "/a/b/c")
      expect(url).not_to be_valid
    end
  end

  describe 'path-based routing scenarios' do
    let(:website2) { create(:website, project: project, account: account) }

    it 'allows multiple websites under the same domain with different paths' do
      url1 = create(:website_url, website: website, domain: domain, account: account, path: "/site1")
      url2 = create(:website_url, website: website2, domain: domain, account: account, path: "/site2")

      expect(url1).to be_valid
      expect(url2).to be_valid
      expect(url1.website).not_to eq(url2.website)
    end

    it 'allows root path for a domain' do
      url = create(:website_url, website: website, domain: domain, account: account, path: "/")
      expect(url).to be_valid
      expect(url.path).to eq("/")
    end
  end

  describe 'dependent behavior' do
    it 'is destroyed when website is destroyed' do
      other_domain = create(:domain, account: account)
      create(:website_url, website: website, domain: other_domain, account: account)
      expect { website.destroy }.to change { WebsiteUrl.count }.by(-1)
    end

    it 'is destroyed when domain is destroyed' do
      create(:website_url, website: website, domain: domain, account: account)
      expect { domain.destroy }.to change { WebsiteUrl.count }.by(-1)
    end
  end
end
