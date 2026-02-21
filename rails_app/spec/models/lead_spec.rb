# frozen_string_literal: true

# == Schema Information
#
# Table name: leads
#
#  id         :bigint           not null, primary key
#  email      :string(255)      not null
#  name       :string(255)
#  phone      :string(50)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint           not null
#
# Indexes
#
#  index_leads_on_account_id            (account_id)
#  index_leads_on_account_id_and_email  (account_id,email) UNIQUE
#  index_leads_on_email                 (email)
#
require 'rails_helper'

RSpec.describe Lead, type: :model do
  let(:account) { create(:account) }

  describe 'associations' do
    it { is_expected.to belong_to(:account) }
    it { is_expected.to have_many(:website_leads).dependent(:destroy) }
    it { is_expected.to have_many(:websites).through(:website_leads) }
  end

  describe 'validations' do
    subject { build(:lead, account: account) }

    it { is_expected.to validate_presence_of(:email) }
    it { is_expected.to validate_length_of(:email).is_at_most(255) }
    it { is_expected.to validate_length_of(:name).is_at_most(255).allow_blank }
    it { is_expected.to validate_length_of(:phone).is_at_most(50).allow_blank }

    it 'validates email format' do
      lead = build(:lead, account: account, email: 'invalid')
      expect(lead).not_to be_valid
      expect(lead.errors[:email]).to include('is invalid')
    end

    it 'validates uniqueness of email within account' do
      create(:lead, account: account, email: 'test@example.com')
      duplicate = build(:lead, account: account, email: 'test@example.com')
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:email]).to include('has already been taken')
    end

    it 'allows same email in different accounts' do
      other_account = create(:account)
      create(:lead, account: account, email: 'shared@example.com')
      other_lead = build(:lead, account: other_account, email: 'shared@example.com')
      expect(other_lead).to be_valid
    end

    it 'validates email uniqueness case-insensitively' do
      create(:lead, account: account, email: 'test@example.com')
      duplicate = build(:lead, account: account, email: 'TEST@EXAMPLE.COM')
      expect(duplicate).not_to be_valid
    end
  end

  describe 'email normalization' do
    it 'normalizes email to lowercase' do
      lead = create(:lead, account: account, email: 'TEST@EXAMPLE.COM')
      expect(lead.email).to eq('test@example.com')
    end

    it 'trims whitespace from email' do
      lead = create(:lead, account: account, email: '  test@example.com  ')
      expect(lead.email).to eq('test@example.com')
    end
  end

  describe '.find_or_create_for_signup' do
    let(:project) { create(:project, account: account) }
    let(:website) { create(:website, project: project, account: account) }

    it 'creates a new lead and website_lead for new email' do
      result = Lead.find_or_create_for_signup(
        account: account,
        website: website,
        email: 'new@example.com',
        name: 'New Person',
        phone: '555-1234'
      )

      expect(result[:lead]).to be_persisted
      expect(result[:lead].email).to eq('new@example.com')
      expect(result[:lead].phone).to eq('555-1234')
      expect(result[:website_lead]).to be_persisted
      expect(result[:website_lead].website).to eq(website)
      expect(result[:created]).to be true
    end

    it 'finds existing lead and creates new website_lead for known email on new website' do
      existing_lead = create(:lead, account: account, email: 'existing@example.com')
      website2 = create(:website, project: create(:project, account: account), account: account)

      result = Lead.find_or_create_for_signup(
        account: account,
        website: website2,
        email: 'existing@example.com'
      )

      expect(result[:lead]).to eq(existing_lead)
      expect(result[:website_lead]).to be_persisted
      expect(result[:website_lead].website).to eq(website2)
      expect(result[:created]).to be false
    end

    it 'returns existing website_lead for duplicate signup on same website' do
      existing_lead = create(:lead, account: account, email: 'duplicate@example.com')
      existing_wl = create(:website_lead, lead: existing_lead, website: website)

      result = Lead.find_or_create_for_signup(
        account: account,
        website: website,
        email: 'duplicate@example.com'
      )

      expect(result[:lead]).to eq(existing_lead)
      expect(result[:website_lead]).to eq(existing_wl)
      expect(result[:already_converted]).to be true
    end

    it 'backfills phone on existing lead when phone was blank' do
      existing_lead = create(:lead, account: account, email: 'existing@example.com', phone: nil)
      create(:website_lead, lead: existing_lead, website: website)

      website2 = create(:website, project: create(:project, account: account), account: account)
      result = Lead.find_or_create_for_signup(
        account: account,
        website: website2,
        email: 'existing@example.com',
        phone: '555-9999'
      )

      expect(result[:lead].phone).to eq('555-9999')
    end

    it 'does not overwrite existing phone on lead' do
      existing_lead = create(:lead, account: account, email: 'existing@example.com', phone: '555-0000')
      create(:website_lead, lead: existing_lead, website: website)

      website2 = create(:website, project: create(:project, account: account), account: account)
      result = Lead.find_or_create_for_signup(
        account: account,
        website: website2,
        email: 'existing@example.com',
        phone: '555-9999'
      )

      expect(result[:lead].phone).to eq('555-0000')
    end

    it 'backfills phone on already-converted lead re-submitting same website' do
      existing_lead = create(:lead, account: account, email: 'existing@example.com', phone: nil)
      create(:website_lead, lead: existing_lead, website: website)

      result = Lead.find_or_create_for_signup(
        account: account,
        website: website,
        email: 'existing@example.com',
        phone: '555-9999'
      )

      expect(result[:already_converted]).to be true
      expect(result[:lead].reload.phone).to eq('555-9999')
    end

    it 'does not overwrite existing phone on already-converted lead' do
      existing_lead = create(:lead, account: account, email: 'existing2@example.com', phone: '555-0000')
      create(:website_lead, lead: existing_lead, website: website)

      result = Lead.find_or_create_for_signup(
        account: account,
        website: website,
        email: 'existing2@example.com',
        phone: '555-9999'
      )

      expect(result[:already_converted]).to be true
      expect(result[:lead].reload.phone).to eq('555-0000')
    end

    it 'stores attribution data on the website_lead' do
      visit = create(:ahoy_visit, website: website)

      result = Lead.find_or_create_for_signup(
        account: account,
        website: website,
        email: 'attributed@example.com',
        visit: visit,
        visitor_token: 'visitor-xyz',
        gclid: 'gclid-123',
        fbclid: 'fbclid-456'
      )

      expect(result[:website_lead].visit).to eq(visit)
      expect(result[:website_lead].visitor_token).to eq('visitor-xyz')
      expect(result[:website_lead].gclid).to eq('gclid-123')
      expect(result[:website_lead].fbclid).to eq('fbclid-456')
    end

    it 'stores UTM parameters denormalized on the website_lead' do
      result = Lead.find_or_create_for_signup(
        account: account,
        website: website,
        email: 'utm-test@example.com',
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'spring_sale',
        utm_content: 'banner_ad',
        utm_term: 'running shoes'
      )

      expect(result[:website_lead].utm_source).to eq('google')
      expect(result[:website_lead].utm_medium).to eq('cpc')
      expect(result[:website_lead].utm_campaign).to eq('spring_sale')
      expect(result[:website_lead].utm_content).to eq('banner_ad')
      expect(result[:website_lead].utm_term).to eq('running shoes')
    end
  end
end
