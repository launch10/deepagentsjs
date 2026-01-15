# frozen_string_literal: true

# == Schema Information
#
# Table name: website_leads
#
#  id            :bigint           not null, primary key
#  gclid         :string
#  utm_campaign  :string
#  utm_content   :string
#  utm_medium    :string
#  utm_source    :string
#  utm_term      :string
#  visitor_token :string
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#  lead_id       :bigint           not null
#  visit_id      :bigint
#  website_id    :bigint           not null
#
# Indexes
#
#  index_website_leads_on_gclid                   (gclid)
#  index_website_leads_on_lead_id                 (lead_id)
#  index_website_leads_on_lead_id_and_website_id  (lead_id,website_id) UNIQUE
#  index_website_leads_on_visit_id                (visit_id)
#  index_website_leads_on_visitor_token           (visitor_token)
#  index_website_leads_on_website_id              (website_id)
#
require 'rails_helper'

RSpec.describe WebsiteLead, type: :model do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project, account: account) }
  let(:lead) { create(:lead, account: account, email: 'test@example.com') }

  describe 'associations' do
    it { is_expected.to belong_to(:lead) }
    it { is_expected.to belong_to(:website) }
    it { is_expected.to belong_to(:visit).class_name('Ahoy::Visit').optional }
  end

  describe 'validations' do
    subject { build(:website_lead, lead: lead, website: website) }

    # Note: belongs_to associations validate presence by default in Rails 5+

    it 'validates uniqueness of lead per website' do
      create(:website_lead, lead: lead, website: website)
      duplicate = build(:website_lead, lead: lead, website: website)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:lead_id]).to include('has already been taken')
    end
  end

  describe 'creating website leads' do
    it 'creates a website lead with attribution data' do
      visit = create(:ahoy_visit, website: website)

      website_lead = WebsiteLead.create!(
        lead: lead,
        website: website,
        visit: visit,
        visitor_token: 'visitor-abc',
        gclid: 'test-gclid-123'
      )

      expect(website_lead).to be_persisted
      expect(website_lead.visitor_token).to eq('visitor-abc')
      expect(website_lead.gclid).to eq('test-gclid-123')
      expect(website_lead.visit).to eq(visit)
    end

    it 'allows same lead to convert on multiple websites' do
      website2 = create(:website, project: create(:project, account: account), account: account)

      create(:website_lead, lead: lead, website: website)
      create(:website_lead, lead: lead, website: website2)

      expect(lead.website_leads.count).to eq(2)
      expect(lead.websites).to contain_exactly(website, website2)
    end
  end

  describe 'querying' do
    it 'can find all leads for a website' do
      lead2 = create(:lead, account: account, email: 'other@example.com')

      create(:website_lead, lead: lead, website: website)
      create(:website_lead, lead: lead2, website: website)

      expect(website.leads.count).to eq(2)
      expect(website.leads).to contain_exactly(lead, lead2)
    end

    it 'can find all websites a lead converted on' do
      website2 = create(:website, project: create(:project, account: account), account: account)

      create(:website_lead, lead: lead, website: website)
      create(:website_lead, lead: lead, website: website2)

      expect(lead.websites.count).to eq(2)
    end
  end
end
