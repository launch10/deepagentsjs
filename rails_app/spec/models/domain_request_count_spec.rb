# == Schema Information
#
# Table name: domain_request_counts
#
#  id            :integer          not null, primary key
#  domain_id     :integer          not null
#  account_id    :integer          not null
#  request_count :integer          not null
#  hour          :timestamptz      not null, primary key
#  created_at    :timestamptz      not null
#
# Indexes
#
#  index_domain_request_counts_on_account_domain_and_hour  (account_id,domain_id,hour) UNIQUE
#  index_domain_request_counts_on_account_id_and_hour      (account_id,hour)
#  index_domain_request_counts_on_domain_hour_count        (domain_id,hour,request_count)
#  index_domain_request_counts_on_domain_id_and_hour       (domain_id,hour)
#

require 'rails_helper'

RSpec.describe DomainRequestCount, type: :model do
  # Create partitions for the hours we'll use in tests
  before(:all) do
    # Create partitions for current hour and surrounding hours
    start_time = 26.hours.ago
    end_time = 2.hours.from_now
    ensure_partitions_exist_for_range(start_time, end_time)
  end
  describe 'validations' do
    it { should validate_presence_of(:domain) }
    it { should validate_presence_of(:account) }
    it { should validate_presence_of(:request_count) }
    it { should validate_numericality_of(:request_count).is_greater_than_or_equal_to(0) }
  end

  describe '.process_traffic_report' do
    let(:account) { create(:account) }
    let(:domain1) { create(:domain, account: account, domain: 'example.com') }
    let(:domain2) { create(:domain, account: account, domain: 'test.com') }
    let(:zone_id) { 'zone123' }
    let(:start_time) { Time.current.beginning_of_hour }

    let(:traffic_report) do
      {
        'example.com' => 100,
        'test.com' => 50
      }
    end

    before do
      domain1
      domain2
    end

    it 'creates domain request counts with proper IDs' do
      expect {
        DomainRequestCount.process_traffic_report(
          traffic_report: traffic_report,
          start_time: start_time,
          zone_id: zone_id
        )
      }.to change(DomainRequestCount, :count).by(2)

      count1 = DomainRequestCount.find_by(domain: domain1, hour: start_time)
      count2 = DomainRequestCount.find_by(domain: domain2, hour: start_time)

      expect(count1).to be_present
      expect(count1.id).to be_present
      expect(count1.request_count).to eq(100)
      expect(count1.created_at).to be_present

      expect(count2).to be_present
      expect(count2.id).to be_present
      expect(count2.request_count).to eq(50)
      expect(count2.created_at).to be_present
    end

    it 'updates existing records on conflict' do
      # Create initial record
      existing = DomainRequestCount.create!(
        domain: domain1,
        account: account,
        hour: start_time,
        request_count: 25,
        created_at: Time.current
      )

      expect {
        DomainRequestCount.process_traffic_report(
          traffic_report: traffic_report,
          start_time: start_time,
          zone_id: zone_id
        )
      }.to change(DomainRequestCount, :count).by(1) # Only domain2 is new

      existing.reload
      expect(existing.request_count).to eq(100) # Updated from 25 to 100
    end

    it 'sets cloudflare_zone_id on domains' do
      DomainRequestCount.process_traffic_report(
        traffic_report: traffic_report,
        start_time: start_time,
        zone_id: zone_id
      )

      domain1.reload
      domain2.reload

      expect(domain1.cloudflare_zone_id).to eq(zone_id)
      expect(domain2.cloudflare_zone_id).to eq(zone_id)
    end

    it 'handles empty traffic report gracefully' do
      expect {
        DomainRequestCount.process_traffic_report(
          traffic_report: {},
          start_time: start_time,
          zone_id: zone_id
        )
      }.not_to change(DomainRequestCount, :count)
    end

    it 'skips domains without records and logs error' do
      allow(Rollbar).to receive(:error)

      traffic_with_unknown = traffic_report.merge('unknown.com' => 75)

      expect {
        DomainRequestCount.process_traffic_report(
          traffic_report: traffic_with_unknown,
          start_time: start_time,
          zone_id: zone_id
        )
      }.to change(DomainRequestCount, :count).by(2) # Only known domains

      expect(Rollbar).to have_received(:error).with(
        "Traffic report found for domain without a domain record",
        domain: 'www.unknown.com'
      )
    end
  end

  describe 'scopes' do
    let(:account1) { create(:account) }
    let(:account2) { create(:account) }
    let(:domain1) { create(:domain, account: account1) }
    let(:domain2) { create(:domain, account: account2) }

    let!(:count1) { create(:domain_request_count, domain: domain1, account: account1, hour: 1.hour.ago, request_count: 100) }
    let!(:count2) { create(:domain_request_count, domain: domain2, account: account2, hour: 2.hours.ago, request_count: 50) }
    let!(:count3) { create(:domain_request_count, domain: domain1, account: account1, hour: 25.hours.ago, request_count: 75) }

    describe '.for_account' do
      it 'returns counts for specific account' do
        results = DomainRequestCount.for_account(account1)
        expect(results).to include(count1, count3)
        expect(results).not_to include(count2)
      end
    end

    describe '.for_domain' do
      it 'returns counts for specific domain' do
        results = DomainRequestCount.for_domain(domain1)
        expect(results).to include(count1, count3)
        expect(results).not_to include(count2)
      end
    end

    describe '.recent' do
      it 'returns counts within specified duration' do
        results = DomainRequestCount.recent(24.hours)
        expect(results).to include(count1, count2)
        expect(results).not_to include(count3)
      end
    end

    describe '.with_traffic' do
      let!(:count4) { create(:domain_request_count, domain: domain1, account: account1, hour: 1.hour.ago, request_count: 0) }

      it 'returns only counts with traffic > 0' do
        results = DomainRequestCount.with_traffic
        expect(results).to include(count1, count2, count3)
        expect(results).not_to include(count4)
      end
    end
  end
end
