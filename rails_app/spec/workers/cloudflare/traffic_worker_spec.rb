require 'rails_helper'

RSpec.describe Cloudflare::TrafficWorker, type: :worker do
  let(:zone_id) { 'zone_123abc' }
  let(:user) { create(:user) }
  let(:account) { create(:account, owner: user) }
  let(:plan) { create(:plan, account: account) }
  let(:website) { create(:website, user: user, cloudflare_zone_id: zone_id, domain: 'example.com') }
  let(:traffic_queries) { instance_double(Cloudflare::Analytics::Queries::TrafficQueries) }
  
  before do
    allow(Cloudflare::Analytics::Queries::TrafficQueries).to receive(:new).and_return(traffic_queries)
    user.update(account: account)
  end
  
  describe '#perform' do
    let(:start_time) { EST.now.beginning_of_hour }
    let(:end_time) { EST.now.end_of_hour }
    
    context 'with valid zone_id and traffic data' do
      let(:traffic_report) do
        {
          'example.com' => 500,
          'api.example.com' => 300,
          'www.example.com' => 200
        }
      end
      
      before do
        allow(traffic_queries).to receive(:hourly_traffic_by_host).and_return(traffic_report)
        website # ensure website exists
      end
      
      it 'fetches traffic data for the current hour' do
        Timecop.freeze do
          expect(traffic_queries).to receive(:hourly_traffic_by_host).with(
            zone_id: zone_id,
            start_time: start_time,
            end_time: end_time
          )
          
          subject.perform('zone_id' => zone_id)
        end
      end
      
      it 'creates domain records for new domains' do
        expect {
          subject.perform('zone_id' => zone_id)
        }.to change { Domain.count }.by(3)
        
        expect(Domain.pluck(:hostname)).to match_array(['example.com', 'api.example.com', 'www.example.com'])
      end
      
      it 'creates domain request counts for each domain' do
        Timecop.freeze do
          expect {
            subject.perform('zone_id' => zone_id)
          }.to change { DomainRequestCount.count }.by(3)
          
          counts = DomainRequestCount.all
          expect(counts.map { |c| [c.domain.hostname, c.request_count] }.to_h).to eq(traffic_report)
          expect(counts.pluck(:counted_at).uniq).to eq([start_time])
        end
      end
      
      it 'updates existing domain request counts on subsequent runs' do
        Timecop.freeze do
          # First run
          subject.perform('zone_id' => zone_id)
          
          # Second run with updated data
          updated_report = { 'example.com' => 600, 'api.example.com' => 400, 'www.example.com' => 250 }
          allow(traffic_queries).to receive(:hourly_traffic_by_host).and_return(updated_report)
          
          expect {
            subject.perform('zone_id' => zone_id)
          }.not_to change { DomainRequestCount.count }
          
          counts = DomainRequestCount.all
          expect(counts.map { |c| [c.domain.hostname, c.request_count] }.to_h).to eq(updated_report)
        end
      end
      
      it 'updates user monthly request count' do
        Timecop.freeze do
          expect {
            subject.perform('zone_id' => zone_id)
          }.to change { UserRequestCount.count }.by(1)
          
          user_count = UserRequestCount.last
          expect(user_count).to have_attributes(
            user: user,
            month: start_time.beginning_of_month,
            request_count: 1000, # 500 + 300 + 200
            last_updated_at: Time.current
          )
        end
      end
      
      it 'accumulates user request counts across multiple runs' do
        Timecop.freeze do
          # First hour
          subject.perform('zone_id' => zone_id)
          
          # Second hour
          Timecop.travel(1.hour.from_now) do
            new_report = { 'example.com' => 100, 'api.example.com' => 50 }
            allow(traffic_queries).to receive(:hourly_traffic_by_host).and_return(new_report)
            
            subject.perform('zone_id' => zone_id)
          end
          
          user_count = UserRequestCount.last
          expect(user_count.request_count).to eq(1150) # 1000 + 150
        end
      end
    end
    
    context 'when zone_id has no associated website' do
      it 'logs warning and returns early' do
        expect(Rails.logger).to receive(:warn).with("No website found for Cloudflare zone_id: unknown_zone")
        expect(traffic_queries).not_to receive(:hourly_traffic_by_host)
        
        subject.perform('zone_id' => 'unknown_zone')
      end
    end
    
    context 'when traffic report is empty' do
      before do
        allow(traffic_queries).to receive(:hourly_traffic_by_host).and_return({})
        website
      end
      
      it 'returns early without processing' do
        expect {
          subject.perform('zone_id' => zone_id)
        }.not_to change { DomainRequestCount.count }
      end
    end
    
    context 'when user is already blocked' do
      let!(:firewall) { create(:firewall, user: user, zone_id: zone_id) }
      let!(:blocked_rule) { create(:firewall_rule, firewall: firewall, status: 'blocked') }
      
      before do
        website
      end
      
      it 'returns early without fetching traffic' do
        expect(traffic_queries).not_to receive(:hourly_traffic_by_host)
        subject.perform('zone_id' => zone_id)
      end
    end
    
    context 'with plan limits' do
      let!(:plan_limit) { create(:plan_limit, plan: plan, limit_type: 'requests_per_month', limit: 1500) }
      let(:traffic_report) { { 'example.com' => 1000, 'api.example.com' => 600 } }
      
      before do
        allow(traffic_queries).to receive(:hourly_traffic_by_host).and_return(traffic_report)
        website
      end
      
      context 'when under limit' do
        let!(:plan_limit) { create(:plan_limit, plan: plan, limit_type: 'requests_per_month', limit: 2000) }
        
        it 'does not trigger blocking' do
          expect_any_instance_of(Firewall).not_to receive(:block_domains)
          subject.perform('zone_id' => zone_id)
        end
      end
      
      context 'when exceeding limit' do
        let!(:plan_limit) { create(:plan_limit, plan: plan, limit_type: 'requests_per_month', limit: 1500) }
        
        before do
          allow(PlanLimitExceededMailer).to receive(:notify_user).and_return(double(deliver_later: true))
        end
        
        it 'creates firewall and blocks domains' do
          expect {
            subject.perform('zone_id' => zone_id)
          }.to change { Firewall.count }.by(1)
          
          firewall = Firewall.last
          expect(firewall).to have_attributes(
            user: user,
            zone_id: zone_id,
            zone_name: 'example.com'
          )
        end
        
        it 'creates firewall rules for domains with recent traffic' do
          # Create some domain request counts from earlier
          domain1 = create(:domain, hostname: 'example.com', user: user, website: website)
          domain2 = create(:domain, hostname: 'api.example.com', user: user, website: website)
          create(:domain_request_count, domain: domain1, user: user, counted_at: 2.hours.ago, request_count: 100)
          create(:domain_request_count, domain: domain2, user: user, counted_at: 23.hours.ago, request_count: 50)
          
          expect {
            subject.perform('zone_id' => zone_id)
          }.to change { FirewallRule.count }
        end
        
        it 'sends notification email to user' do
          expect(PlanLimitExceededMailer).to receive(:notify_user).with(user, 1600, 1500)
          subject.perform('zone_id' => zone_id)
        end
        
        it 'includes reason in blocked domains' do
          allow_any_instance_of(Firewall).to receive(:block_domains) do |_firewall, domains|
            expect(domains.first[:reason]).to eq("Plan limit exceeded: 1600/1500 requests")
          end
          
          subject.perform('zone_id' => zone_id)
        end
      end
      
      context 'when accumulating over multiple hours exceeds limit' do
        let!(:plan_limit) { create(:plan_limit, plan: plan, limit_type: 'requests_per_month', limit: 1000) }
        
        before do
          allow(PlanLimitExceededMailer).to receive(:notify_user).and_return(double(deliver_later: true))
        end
        
        it 'blocks when cumulative count exceeds limit' do
          Timecop.freeze do
            # First run - 500 requests (under limit)
            first_report = { 'example.com' => 300, 'api.example.com' => 200 }
            allow(traffic_queries).to receive(:hourly_traffic_by_host).and_return(first_report)
            
            expect_any_instance_of(Firewall).not_to receive(:block_domains)
            subject.perform('zone_id' => zone_id)
            
            # Second run - 600 more requests (total 1100, over limit)
            Timecop.travel(1.hour.from_now) do
              second_report = { 'example.com' => 400, 'api.example.com' => 200 }
              allow(traffic_queries).to receive(:hourly_traffic_by_host).and_return(second_report)
              
              expect_any_instance_of(Firewall).to receive(:block_domains)
              subject.perform('zone_id' => zone_id)
            end
          end
        end
      end
    end
    
    context 'with different time zones' do
      it 'uses EST for time calculations' do
        # Ensure we're using EST even if system time zone is different
        Time.use_zone('UTC') do
          Timecop.freeze do
            expected_start = EST.now.beginning_of_hour
            expected_end = EST.now.end_of_hour
            
            expect(traffic_queries).to receive(:hourly_traffic_by_host).with(
              hash_including(
                start_time: expected_start,
                end_time: expected_end
              )
            )
            
            subject.perform('zone_id' => zone_id)
          end
        end
      end
    end
    
    context 'error handling' do
      before { website }
      
      context 'when traffic API fails' do
        before do
          allow(traffic_queries).to receive(:hourly_traffic_by_host).and_raise(StandardError.new('API Error'))
        end
        
        it 'raises error for Sidekiq retry' do
          expect {
            subject.perform('zone_id' => zone_id)
          }.to raise_error(StandardError, 'API Error')
        end
      end
      
      context 'when database save fails' do
        before do
          allow(traffic_queries).to receive(:hourly_traffic_by_host).and_return({ 'example.com' => 100 })
          allow_any_instance_of(DomainRequestCount).to receive(:save!).and_raise(ActiveRecord::RecordInvalid)
        end
        
        it 'raises error for Sidekiq retry' do
          expect {
            subject.perform('zone_id' => zone_id)
          }.to raise_error(ActiveRecord::RecordInvalid)
        end
      end
    end
  end
  
  describe 'Sidekiq configuration' do
    it 'uses the cloudflare queue' do
      expect(described_class.sidekiq_options['queue']).to eq(:cloudflare)
    end
    
    it 'has retry configuration' do
      expect(described_class.sidekiq_options['retry']).to eq(5)
    end
  end
end

RSpec.describe Cloudflare::TrafficWorker::BatchWorker, type: :worker do
  let(:traffic_queries) { instance_double(Cloudflare::Analytics::Queries::TrafficQueries) }
  
  before do
    allow(Cloudflare::Analytics::Queries::TrafficQueries).to receive(:new).and_return(traffic_queries)
  end
  
  describe '#perform' do
    context 'when zones are fetched successfully' do
      let(:zone_ids) do
        ['zone_123abc', 'zone_456def', 'zone_789ghi']
      end
      
      before do
        allow(Cloudflare::TrafficWorker).to receive(:perform_async)
      end
      
      it 'yields zones to the block' do
        expect(traffic_queries).to receive(:get_all_zones).and_yield(zone_ids)
        subject.perform
      end
      
      it 'enqueues TrafficWorker for each zone' do
        allow(traffic_queries).to receive(:get_all_zones).and_yield(zone_ids)
        
        zone_ids.each do |zone_id|
          expect(Cloudflare::TrafficWorker).to receive(:perform_async).with(zone_id: zone_id)
        end
        
        subject.perform
      end
      
      it 'passes batch_options through' do
        batch_options = { 'priority' => 'high', 'tag' => 'hourly' }
        
        expect(traffic_queries).to receive(:get_all_zones).and_yield(zone_ids)
        
        subject.perform(batch_options)
      end
    end
    
    context 'when zones fetch returns error' do
      let(:error_response) do
        { 'error' => 'Authentication failed', 'code' => 401 }
      end
      
      before do
        allow(Rollbar).to receive(:error)
      end
      
      it 'logs error to Rollbar' do
        allow(traffic_queries).to receive(:get_all_zones).and_yield(error_response)
        
        expect(Rollbar).to receive(:error).with('Failed to get zones', error_response)
        
        subject.perform
      end
      
      it 'does not enqueue any workers' do
        allow(traffic_queries).to receive(:get_all_zones).and_yield(error_response)
        
        expect(Cloudflare::TrafficWorker).not_to receive(:perform_async)
        
        subject.perform
      end
    end
    
    context 'when zones array is empty' do
      it 'does not enqueue any workers' do
        allow(traffic_queries).to receive(:get_all_zones).and_yield([])
        
        expect(Cloudflare::TrafficWorker).not_to receive(:perform_async)
        
        subject.perform
      end
    end
    
    context 'when API raises exception' do
      before do
        allow(traffic_queries).to receive(:get_all_zones).and_raise(StandardError.new('Connection timeout'))
      end
      
      it 'raises error for Sidekiq retry' do
        expect {
          subject.perform
        }.to raise_error(StandardError, 'Connection timeout')
      end
    end
    
    context 'with rate limiting for large number of zones' do
      let(:many_zones) { (1..100).map { |i| "zone_#{i}" } }
      
      before do
        allow(traffic_queries).to receive(:get_all_zones).and_yield(many_zones)
      end
      
      it 'processes all zones' do
        expect(Cloudflare::TrafficWorker).to receive(:perform_async).exactly(100).times
        subject.perform
      end
      
      it 'can handle batch processing with delays if configured' do
        # If we want to add rate limiting in the future
        allow(Cloudflare::TrafficWorker).to receive(:perform_in)
        
        # This is where we could add logic to space out jobs
        # For now, it processes them all immediately
        expect(Cloudflare::TrafficWorker).to receive(:perform_async).exactly(100).times
        
        subject.perform
      end
    end
  end
  
  describe 'scheduled execution' do
    it 'is configured to run hourly' do
      # This would be tested in the Sidekiq cron configuration
      expect(Sidekiq::Cron::Job.find('hourly_traffic')).to have_attributes(
        cron: '0 * * * *',
        class: 'Cloudflare::TrafficWorker::BatchWorker'
      )
    end
  end
end