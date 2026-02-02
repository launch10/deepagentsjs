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
  let(:domain) { create(:domain, account: account) }

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

    it 'validates domain belongs to account' do
      other_account = create(:account)
      other_domain = create(:domain, account: other_account)

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

    it 'validates only one website_url per website' do
      create(:website_url, website: website, domain: domain, account: account, path: "/")
      other_domain = create(:domain, account: account)
      duplicate = build(:website_url, website: website, domain: other_domain, account: account, path: "/other")
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:website]).to include("already has a URL assigned")
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

  describe 'update-in-place pattern (1:1 with Website)' do
    # Modeled after location_targets id stability tests in updating_spec.rb
    # Simplified because Website has_one WebsiteUrl (not has_many)

    let(:domain1) { create(:domain, account: account) }
    let(:domain2) { create(:domain, account: account) }

    it 'preserves WebsiteUrl ID when domain changes' do
      # First assignment
      website_url = create(:website_url, website: website, domain: domain1, account: account, path: "/")
      original_id = website_url.id

      # Change domain - should update same record, not create new
      website_url.update!(domain: domain2)

      expect(website_url.id).to eq(original_id)
      expect(website.reload.website_url.id).to eq(original_id)
    end

    it 'preserves WebsiteUrl ID when path changes' do
      website_url = create(:website_url, website: website, domain: domain1, account: account, path: "/")
      original_id = website_url.id

      # Change path - should update same record
      website_url.update!(path: "/pricing")

      expect(website_url.id).to eq(original_id)
    end

    it 'preserves WebsiteUrl ID when both domain and path change' do
      website_url = create(:website_url, website: website, domain: domain1, account: account, path: "/")
      original_id = website_url.id

      # Change both - still same record
      website_url.update!(domain: domain2, path: "/services")

      expect(website_url.id).to eq(original_id)
      expect(website.reload.website_url.domain).to eq(domain2)
      expect(website.reload.website_url.path).to eq("/services")
    end

    it 'does not create additional WebsiteUrl records' do
      website_url = create(:website_url, website: website, domain: domain1, account: account, path: "/")
      initial_count = WebsiteUrl.count

      # Multiple updates - should never create new records
      website_url.update!(domain: domain2)
      website_url.update!(path: "/pricing")
      website_url.update!(domain: domain1, path: "/")

      expect(WebsiteUrl.count).to eq(initial_count)
    end

    it 'does not affect WebsiteUrls from other websites' do
      website2 = create(:website, project: project, account: account)
      create(:website_url, website: website, domain: domain1, account: account, path: "/")
      website2_url = create(:website_url, website: website2, domain: domain2, account: account, path: "/other")

      website2_url_id = website2_url.id

      # Update website1's URL - should not affect website2
      website.website_url.update!(domain: domain2, path: "/new")

      expect(website2.reload.website_url.id).to eq(website2_url_id)
      expect(website2.website_url.path).to eq("/other")
    end
  end

  describe '.assign_to_website!' do
    let(:domain1) { create(:domain, account: account) }
    let(:domain2) { create(:domain, account: account) }

    it 'creates a new WebsiteUrl if none exists' do
      expect(website.website_url).to be_nil

      website_url = WebsiteUrl.assign_to_website!(website: website, domain: domain1, path: "/landing")

      expect(website_url).to be_persisted
      expect(website_url.domain).to eq(domain1)
      expect(website_url.path).to eq("/landing")
    end

    it 'updates existing WebsiteUrl in place' do
      original_url = create(:website_url, website: website, domain: domain1, account: account, path: "/")
      original_id = original_url.id

      website_url = WebsiteUrl.assign_to_website!(website: website, domain: domain2, path: "/pricing")

      expect(website_url.id).to eq(original_id)
      expect(website_url.domain).to eq(domain2)
      expect(website_url.path).to eq("/pricing")
    end

    it 'preserves ID across multiple reassignments' do
      original_url = WebsiteUrl.assign_to_website!(website: website, domain: domain1, path: "/")
      original_id = original_url.id

      # Multiple reassignments
      WebsiteUrl.assign_to_website!(website: website, domain: domain2, path: "/v2")
      WebsiteUrl.assign_to_website!(website: website, domain: domain1, path: "/v3")
      final_url = WebsiteUrl.assign_to_website!(website: website, domain: domain2, path: "/final")

      expect(final_url.id).to eq(original_id)
      expect(WebsiteUrl.where(website: website).count).to eq(1)
    end
  end

  describe '.assign_domain_to_website' do
    let(:domain1) { create(:domain, account: account) }

    it 'creates domain if it does not exist' do
      result = WebsiteUrl.assign_domain_to_website(
        website: website,
        domain_string: "new-site.launch10.site",
        path: "/",
        account: account
      )

      expect(result[:success]).to be true
      expect(result[:domain].domain).to eq("new-site.launch10.site")
      expect(result[:website_url]).to be_persisted
    end

    it 'reuses existing domain owned by account' do
      result = WebsiteUrl.assign_domain_to_website(
        website: website,
        domain_string: domain1.domain,
        path: "/landing",
        account: account
      )

      expect(result[:success]).to be true
      expect(result[:domain].id).to eq(domain1.id)
      expect(result[:website_url].path).to eq("/landing")
    end

    it 'fails if domain is owned by another account' do
      other_account = create(:account)
      other_domain = create(:domain, account: other_account)

      result = WebsiteUrl.assign_domain_to_website(
        website: website,
        domain_string: other_domain.domain,
        path: "/",
        account: account
      )

      expect(result[:success]).to be false
      expect(result[:error]).to eq("This domain is not available")
    end

    it 'updates existing WebsiteUrl in place' do
      original_url = create(:website_url, website: website, domain: domain1, account: account, path: "/")
      original_id = original_url.id

      result = WebsiteUrl.assign_domain_to_website(
        website: website,
        domain_string: "different-site.launch10.site",
        path: "/pricing",
        account: account
      )

      expect(result[:success]).to be true
      expect(result[:website_url].id).to eq(original_id)
    end
  end
end
