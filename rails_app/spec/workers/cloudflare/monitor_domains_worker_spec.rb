require "rails_helper"
require "support/subscription_helpers"

RSpec.describe Cloudflare::MonitorDomainsWorker, type: :worker do
  include SubscriptionHelpers

  let(:zone_id) { "zone_123abc" }
  let!(:plan) { create(:plan, name: "starter") }
  let(:apples_user) { create_subscribed_user(plan_name: plan.name) }
  let(:bananas_user) { create_subscribed_user(plan_name: plan.name) }
  let(:apples_account) { create(:account, owner: apples_user) }
  let(:bananas_account) { create(:account, owner: bananas_user) }
  let(:apples_domain) { create(:domain, user: apples_user, domain: "apples.example.com", website: apples_website) }
  let(:bananas_domain) { create(:domain, user: bananas_user, domain: "bananas.example.com", website: bananas_website) }
  let(:www_domain) { create(:domain, user: apples_user, domain: "www.example.com", website: website) }
  let(:website) { create(:website, user: apples_user, name: "www") }
  let(:apples_website) { create(:website, user: apples_user, name: "apples") }
  let(:bananas_website) { create(:website, user: bananas_user, name: "bananas") }
  let(:domain_monitor) { instance_double(Cloudflare::Analytics::Queries::MonitorDomains) }
  
  # Time helpers
  let(:day1) { UTC.parse("2025-08-01 00:00:00") }
  let(:day2) { UTC.parse("2025-08-02 00:00:00") }
  let(:next_month_day1) { UTC.parse("2025-09-01 00:00:00") }
  let(:next_month_day2) { UTC.parse("2025-09-02 00:00:00") }
  
  before(:all) do
    Timecop.freeze(UTC.parse("2025-08-01 00:00:00")) do
      DomainRequestCount.drop_all_partitions
      UserRequestCount.drop_all_partitions

      # Create partitions only for the days we're testing
      DomainRequestCount.create_partitions(3) # Aug 1-3
      UserRequestCount.create_partitions(2) # Aug and Sept
    end
    
    # Also create Sept 1 partitions since we test month boundaries
    Timecop.freeze(UTC.parse("2025-09-01 00:00:00")) do
      DomainRequestCount.create_partitions(1) # Sept 1
    end
  end

  before do
    allow(Cloudflare::Analytics::Queries::MonitorDomains).to receive(:new).and_return(domain_monitor)
    AccountUser.create(account: apples_account, user: apples_user, roles: [:admin])
    AccountUser.create(account: bananas_account, user: bananas_user, roles: [:admin])
    
    # Set up domains
    www_domain
    apples_domain
    bananas_domain
  end
  
  describe "#perform" do
    context "domain request count behavior" do
      # Comprehensive traffic report with data for different times
      let(:traffic_report) do
        {
          # Day 1, 10am - Initial traffic
          "2025-08-01 10:00:00" => {
            "example.com" => 50_000,
            "apples.example.com" => 30_000,
            "bananas.example.com" => 300,
            "www.example.com" => 20_000
          },
          # Day 1, 10:30am - Updated traffic for same hour (should replace, not accumulate)
          "2025-08-01 10:30:00" => {
            "example.com" => 70_000,  # Changed from 50k to 70k
            "apples.example.com" => 35_000,  # Changed from 30k to 35k
            "bananas.example.com" => 400,
            "www.example.com" => 25_000
          },
          # Day 1, 11am - Next hour's traffic
          "2025-08-01 11:00:00" => {
            "example.com" => 2000,
            "apples.example.com" => 700,
            "bananas.example.com" => 100,
            "www.example.com" => 500
          },
          # Day 2 - Different day
          "2025-08-02 10:00:00" => {
            "example.com" => 500,
            "apples.example.com" => 300,
            "bananas.example.com" => 300,
            "www.example.com" => 200
          },
          # Next month - For testing monthly boundaries
          "2025-09-01 10:00:00" => {
            "example.com" => 1000,
            "apples.example.com" => 600,
            "bananas.example.com" => 400,
            "www.example.com" => 300
          }
        }
      end
      
      before do
        # Mock the domain monitor to return traffic based on current frozen time
        allow(domain_monitor).to receive(:hourly_traffic_by_host) do |args|
          current_time = UTC.now.strftime("%Y-%m-%d %H:%M:%S")
          # Find the exact match first, then fall back to hour match
          exact_match = traffic_report[current_time]
          if exact_match
            exact_match
          else
            # Find any report that matches the current hour
            hour_prefix = current_time[0..12] # "2025-08-01 10"
            traffic_report.find { |time, _| time.start_with?(hour_prefix) }&.last || {}
          end
        end
      end
      it "creates domain request counts for each domain" do
        Timecop.freeze(UTC.parse("2025-08-01 10:00:00")) do
          expect {
            subject.perform(zone_id)
          }.to change { DomainRequestCount.count }.by(3)
          
          counts = DomainRequestCount.all
          report = counts.map { |c| [c.domain.domain, c.request_count] }.to_h
          
          # www.example.com should combine example.com + www.example.com
          expect(report["www.example.com"]).to eq(70_000) # 50k + 20k
          expect(report["apples.example.com"]).to eq(30_000)
          expect(report["bananas.example.com"]).to eq(300)
        end
      end

      it "new data replaces old data for the same hour (not accumulates)" do
        # First report at 10:00am
        Timecop.freeze(UTC.parse("2025-08-01 10:00:00")) do
          subject.perform(zone_id)
          
          count = DomainRequestCount.find_by(
            domain: www_domain,
            user: apples_user,
            hour: UTC.now.beginning_of_hour
          )
          expect(count.request_count).to eq(70_000) # 50k + 20k
        end

        # Second report at 10:30am (same hour, but updated data)
        Timecop.freeze(UTC.parse("2025-08-01 10:30:00")) do
          subject.perform(zone_id)
          
          count = DomainRequestCount.find_by(
            domain: www_domain,
            user: apples_user,
            hour: UTC.parse("2025-08-01 10:00:00").beginning_of_hour
          )
          # Should be 95k (70k + 25k), not 70k + 95k
          expect(count.request_count).to eq(95_000)
          
          # Total for user should be updated values
          total = DomainRequestCount.total_for_user(apples_user, day1, day1.end_of_day)
          expect(total).to eq(130_000) # 95k (www) + 35k (apples)

          user_total = UserRequestCount.find_by(user: apples_user, month: day1.beginning_of_month)
          expect(user_total.request_count).to eq(130_000) # User total matches domain totals
        end
      end
      it "UserRequestCounts equal the sum of all DomainRequestCounts for a user for the month" do
        # Run the worker for each hour in the traffic report
        traffic_report.each do |time, traffic|
          Timecop.freeze(UTC.parse(time)) do
            subject.perform(zone_id)
          end
        end

        # Check apples_user's total
        apples_total = DomainRequestCount.total_for_user(apples_user, day1.beginning_of_month, day1.end_of_month)
        apples_user_count = UserRequestCount.find_by(user: apples_user, month: day1.beginning_of_month)
        
        expect(apples_user_count).to be_present
        expect(apples_user_count.request_count).to eq(apples_total)
        expect(apples_user_count.request_count).to eq(134_200)

        apples_total = DomainRequestCount.total_for_user(apples_user, next_month_day1.beginning_of_month, next_month_day1.end_of_month)
        apples_user_count = UserRequestCount.find_by(user: apples_user, month: next_month_day1.beginning_of_month)
        expect(apples_user_count).to be_present
        expect(apples_user_count.request_count).to eq(apples_total)
        expect(apples_user_count.request_count).to eq(1900)
      end

      it "correctly handles traffic across multiple days" do
        # Day 1
        Timecop.freeze(UTC.parse("2025-08-01 10:00:00")) do
          subject.perform(zone_id)
          day1_total = DomainRequestCount.total_for_user(apples_user, day1, day1.end_of_day)
          expect(day1_total).to eq(100_000) # 70k + 30k
        end

        # Day 2
        Timecop.freeze(UTC.parse("2025-08-02 10:00:00")) do
          subject.perform(zone_id)
          day2_total = DomainRequestCount.total_for_user(apples_user, day2, day2.end_of_day)
          expect(day2_total).to eq(1000) # 500 + 300 + 200
          
          # Month total should include both days
          month_total = DomainRequestCount.total_for_user(apples_user, day1.beginning_of_month, day1.end_of_month)
          expect(month_total).to eq(101_000) # 100k + 1k
        end
      end

      it "handles traffic across month boundaries" do
        # August
        Timecop.freeze(UTC.parse("2025-08-01 10:00:00")) do
          subject.perform(zone_id)
          aug_total = DomainRequestCount.total_for_user(apples_user, day1.beginning_of_month, day1.end_of_month)
          expect(aug_total).to eq(100_000)
        end

        # September
        Timecop.freeze(UTC.parse("2025-09-01 10:00:00")) do
          subject.perform(zone_id)
          sept_total = DomainRequestCount.total_for_user(apples_user, next_month_day1.beginning_of_month, next_month_day1.end_of_month)
          expect(sept_total).to eq(1900) # 1000 + 600 + 300
          
          # August should still have its total
          aug_total = DomainRequestCount.total_for_user(apples_user, day1.beginning_of_month, day1.end_of_month)
          expect(aug_total).to eq(100_000)
        end
      end
    end

    context "plan limit enforcement" do
      let!(:plan_limit) { create(:plan_limit, plan: plan, limit_type: "requests_per_month", limit: 50_000) }
      
      let(:traffic_report) do
        {
          # Under limit
          "2025-08-01 10:00:00" => {
            "example.com" => 10_000,
            "apples.example.com" => 5_000,
            "www.example.com" => 5_000
          },
          # Over limit
          "2025-08-01 11:00:00" => {
            "example.com" => 30_000,
            "apples.example.com" => 20_000,
            "www.example.com" => 10_000
          }
        }
      end
      
      before do
        allow(domain_monitor).to receive(:hourly_traffic_by_host) do |args|
          current_time = UTC.now.strftime("%Y-%m-%d %H:%M:%S")
          traffic_report.select { |time, _| time.start_with?(current_time[0..12]) }.values.first || {}
        end
      end

      it "does not block user when under plan limit" do
        Timecop.freeze(UTC.parse("2025-08-01 10:00:00")) do
          # No blocking should occur
          expect_any_instance_of(Cloudflare::FirewallService).not_to receive(:block_user) if defined?(Cloudflare::FirewallService)
          
          subject.perform(zone_id)
          
          # Verify user's total is under limit
          user_total = DomainRequestCount.total_for_user(apples_user, day1.beginning_of_month, day1.end_of_month)
          expect(user_total).to eq(20_000) # 15k + 5k
          expect(user_total).to be < plan_limit.limit
        end
      end

      it "blocks user when exceeding plan limit" do
        # Mock successful Cloudflare API response
        mock_response = {
          result: { operation_id: "3234eb584eaa461abd7d4be7d070c32a" },
          success: true,
          errors: [],
          messages: []
        }
        
        # Mock the FirewallService to return success response
        firewall_service = instance_double(Cloudflare::FirewallService)
        allow(Cloudflare::FirewallService).to receive(:new).and_return(firewall_service)
        allow(firewall_service).to receive(:block_domains).and_return(
          mock_api_response(mock_response)
        )
        allow(firewall_service).to receive(:search_blocked_domains).and_return(
          {
            "www.example.com" => "274d104045dd4c2492192ca565f8d7e7",
            "apples.example.com" => "3b17fd8fdc6443c7b34844bdb53fb104"
          }
        )
        
        # First get to just under the limit
        Timecop.freeze(UTC.parse("2025-08-01 10:00:00")) do
          subject.perform(zone_id)
        end

        # Now exceed the limit
        Timecop.freeze(UTC.parse("2025-08-01 11:00:00")) do
          # This should trigger blocking
          subject.perform(zone_id)
          
          # Verify user's total exceeds limit
          user_total = DomainRequestCount.total_for_user(apples_user, day1.beginning_of_month, day1.end_of_month)
          expect(user_total).to eq(80_000) # 20k from 10am + 60k from 11am
          expect(user_total).to be > plan_limit.limit
          
          # Verify the user is marked as over limit
          user_count = UserRequestCount.find_by(user: apples_user, month: day1.beginning_of_month)
          expect(user_count).to be_over_limit
        end

        # Process the blocking job
        Sidekiq::Worker.drain_all
        
        # Verify firewall rules were created with 'blocked' status
        firewall_rules = Cloudflare::FirewallRule.where(user: apples_user)
        expect(firewall_rules).not_to be_empty

        www_rule = firewall_rules.find_by(domain_id: www_domain.id)
        expect(www_rule).to be_present
        expect(www_rule.status).to eq("blocked")
        expect(www_rule.cloudflare_rule_id).to eq("274d104045dd4c2492192ca565f8d7e7")

        apples_rule = firewall_rules.find_by(domain_id: apples_domain.id)
        expect(apples_rule).to be_present
        expect(apples_rule.status).to eq("blocked")
        expect(apples_rule.cloudflare_rule_id).to eq("3b17fd8fdc6443c7b34844bdb53fb104")

        firewall = apples_user.firewall
        expect(firewall).to be_present
        expect(firewall.status).to eq("blocked")
        expect(firewall.blocked_at).to be_present
      end

      it "raises error when Cloudflare API returns non-success response" do
        # Mock error response from Cloudflare API
        mock_error_response = {
          result: nil,
          success: false,
          errors: [{ code: 1001, message: "Invalid zone identifier" }],
          messages: []
        }
        
        # Mock the FirewallService to return error response
        firewall_service = instance_double(Cloudflare::FirewallService)
        allow(Cloudflare::FirewallService).to receive(:new).and_return(firewall_service)
        allow(firewall_service).to receive(:block_domains).and_return(
          mock_api_response(mock_error_response, code: 400)
        )
        
        # First get to just under the limit
        Timecop.freeze(UTC.parse("2025-08-01 10:00:00")) do
          subject.perform(zone_id)
        end

        # Now exceed the limit - this should trigger blocking
        Timecop.freeze(UTC.parse("2025-08-01 11:00:00")) do
          subject.perform(zone_id)
          
          # Verify user's total exceeds limit
          user_total = DomainRequestCount.total_for_user(apples_user, day1.beginning_of_month, day1.end_of_month)
          expect(user_total).to eq(80_000)
          expect(user_total).to be > plan_limit.limit
        end

        # Processing the blocking job should raise an error for retry
        expect {
          Sidekiq::Worker.drain_all
        }.to raise_error(StandardError, /Failed to block domains for user/)
        
        # Verify no firewall rules were created due to the error
        firewall_rules = Cloudflare::FirewallRule.where(user: apples_user)
        expect(firewall_rules).to be_empty

        expect(apples_user.firewall).to be_inactive
      end
    end
  end

  describe "Unblocking behavior" do
    let!(:plan_limit) { create(:plan_limit, plan: plan, limit_type: "requests_per_month", limit: 50_000) }
    
    let(:traffic_report) do
      {
        # August - Over limit traffic
        "2025-08-01 10:00:00" => {
          "example.com" => 40_000,
          "apples.example.com" => 30_000,
          "www.example.com" => 20_000
        },
        # September - Under limit traffic
        "2025-09-01 10:00:00" => {
          "example.com" => 5_000,
          "apples.example.com" => 3_000,
          "www.example.com" => 2_000
        }
      }
    end
    
    before do
      allow(domain_monitor).to receive(:hourly_traffic_by_host) do |args|
        current_time = UTC.now.strftime("%Y-%m-%d %H:%M:%S")
        traffic_report.select { |time, _| time.start_with?(current_time[0..12]) }.values.first || {}
      end
    end
    
    context "when user was blocked in previous month" do
      before do
        # First block the user by exceeding limit in August
        Timecop.freeze(UTC.parse("2025-08-01 10:00:00")) do
          # Mock successful blocking response
          mock_block_response = {
            result: { operation_id: "block_operation_123" },
            success: true,
            errors: [],
            messages: []
          }
          
          firewall_service = instance_double(Cloudflare::FirewallService)
          allow(Cloudflare::FirewallService).to receive(:new).and_return(firewall_service)
          allow(firewall_service).to receive(:block_domains).and_return(
            mock_api_response(mock_block_response)
          )
          allow(firewall_service).to receive(:search_blocked_domains).and_return(
            {
              "www.example.com" => "rule_www_123",
              "apples.example.com" => "rule_apples_123"
            }
          )
          
          subject.perform(zone_id)
          Sidekiq::Worker.drain_all
          
          # Verify user was blocked
          expect(apples_user.firewall).to be_blocked
          expect(Cloudflare::FirewallRule.where(user: apples_user).blocked.count).to eq(2)
        end
      end

      it "does not unblock user when still in same month" do
        Timecop.freeze(UTC.parse("2025-08-02 15:00:00")) do
          # User should remain blocked - same month
          subject.perform(zone_id)
          Sidekiq::Worker.drain_all
          
          # Verify user is still blocked
          apples_user.firewall.reload
          expect(apples_user.firewall).to be_blocked
          expect(Cloudflare::FirewallRule.where(user: apples_user).blocked.count).to eq(2)
        end
      end

      it "unblocks user when new month starts" do
        Timecop.freeze(UTC.parse("2025-09-01 10:00:00")) do
          # Mock successful unblocking response
          mock_unblock_response = {
            result: { operation_id: "unblock_operation_456" },
            success: true,
            errors: [],
            messages: []
          }
          
          firewall_service = instance_double(Cloudflare::FirewallService)
          allow(Cloudflare::FirewallService).to receive(:new).and_return(firewall_service)
          allow(firewall_service).to receive(:unblock_domains).with(["rule_www_123", "rule_apples_123"]).and_return(
            mock_api_response(mock_unblock_response)
          )
          
          # Run the monitor worker in the new month
          subject.perform(zone_id)
          Sidekiq::Worker.drain_all
          
          # Verify user was unblocked
          apples_user.firewall.reload
          expect(apples_user.firewall).to be_inactive
          expect(apples_user.firewall.unblocked_at).to be_present
          
          # Verify firewall rules were updated
          firewall_rules = Cloudflare::FirewallRule.where(user: apples_user)
          expect(firewall_rules.blocked.count).to eq(0)
          expect(firewall_rules.inactive.count).to eq(2)
          
          firewall_rules.each do |rule|
            expect(rule.unblocked_at).to be_present
            expect(rule.blocked_at).to be_nil
          end
        end
      end

      it "raises error when Cloudflare unblock API fails" do
        Timecop.freeze(UTC.parse("2025-09-01 10:00:00")) do
          # Mock error response from unblock API
          mock_error_response = {
            result: nil,
            success: false,
            errors: [{ code: 1002, message: "Failed to unblock" }],
            messages: []
          }
          
          firewall_service = instance_double(Cloudflare::FirewallService)
          allow(Cloudflare::FirewallService).to receive(:new).and_return(firewall_service)
          allow(firewall_service).to receive(:unblock_domains).and_return(
            mock_api_response(mock_error_response, code: 500)
          )
          
          # Should raise error for retry
          expect {
            subject.perform(zone_id)
            Sidekiq::Worker.drain_all
          }.to raise_error(StandardError, /Failed to block domains for user/)
          
          # Verify user remains blocked
          apples_user.firewall.reload
          expect(apples_user.firewall).to be_blocked
          expect(Cloudflare::FirewallRule.where(user: apples_user).blocked.count).to eq(2)
        end
      end
    end

    context "when user upgrades plan after being blocked" do
      let!(:pro_plan) { create(:plan, name: "pro") }
      let!(:pro_plan_limit) { create(:plan_limit, plan: pro_plan, limit_type: "requests_per_month", limit: 150_000) }
      
      let(:upgrade_traffic_report) do
        {
          # 10:00 - Over starter limit (90k total)
          "2025-08-01 10:00:00" => {
            "example.com" => 40_000,
            "apples.example.com" => 30_000,
            "www.example.com" => 20_000
          },
          # 11:00 - Same traffic (still 90k total, but now under pro limit)
          "2025-08-01 11:00:00" => {
            "example.com" => 0,
            "apples.example.com" => 0,
            "www.example.com" => 0
          }
        }
      end
      
      before do
        # Override the mock for this context to use upgrade_traffic_report
        allow(domain_monitor).to receive(:hourly_traffic_by_host) do |args|
          current_time = UTC.now.strftime("%Y-%m-%d %H:%M:%S")
          upgrade_traffic_report.select { |time, _| time.start_with?(current_time[0..12]) }.values.first || {}
        end
        
        # First block the user by exceeding starter plan limit in August
        Timecop.freeze(UTC.parse("2025-08-01 10:00:00")) do
          # Mock successful blocking response
          mock_block_response = {
            result: { operation_id: "block_operation_789" },
            success: true,
            errors: [],
            messages: []
          }
          
          firewall_service = instance_double(Cloudflare::FirewallService)
          allow(Cloudflare::FirewallService).to receive(:new).and_return(firewall_service)
          allow(firewall_service).to receive(:block_domains).and_return(
            mock_api_response(mock_block_response)
          )
          allow(firewall_service).to receive(:search_blocked_domains).and_return(
            {
              "www.example.com" => "rule_www_456",
              "apples.example.com" => "rule_apples_456"
            }
          )
          
          subject.perform(zone_id)
          Sidekiq::Worker.drain_all
          
          # Verify user was blocked (90k > 50k starter limit)
          expect(apples_user.firewall).to be_blocked
          expect(Cloudflare::FirewallRule.where(user: apples_user).blocked.count).to eq(2)
        end
      end
      it "unblocks user when they upgrade to pro plan with higher limit" do
        # Still in August, but user upgrades to pro plan
        Timecop.freeze(UTC.parse("2025-08-01 11:00:00")) do
          # Upgrade user to pro plan
          subscribe_account(apples_user.owned_account, plan_name: "pro")
          
          # Mock both blocking and unblocking responses
          firewall_service = instance_double(Cloudflare::FirewallService)
          allow(Cloudflare::FirewallService).to receive(:new).and_return(firewall_service)
          
          # Mock block_domains being called with empty array (all domains already blocked)
          allow(firewall_service).to receive(:block_domains).with([]).and_return(
            mock_api_response({ result: {}, success: true, errors: [], messages: [] })
          )
          
          # Mock search_blocked_domains being called with empty array
          allow(firewall_service).to receive(:search_blocked_domains).with([]).and_return({})
          
          # Mock successful unblocking response
          mock_unblock_response = {
            result: { operation_id: "unblock_operation_789" },
            success: true,
            errors: [],
            messages: []
          }
          allow(firewall_service).to receive(:unblock_domains).with(["rule_www_456", "rule_apples_456"]).and_return(
            mock_api_response(mock_unblock_response)
          )
          
          # Run monitor worker - should unblock because 90k < 150k pro limit
          subject.perform(zone_id)
          Sidekiq::Worker.drain_all
          
          # Verify user was unblocked
          apples_user.firewall.reload
          expect(apples_user.firewall).to be_inactive
          expect(apples_user.firewall.unblocked_at).to be_present
          
          # Verify firewall rules were updated
          firewall_rules = Cloudflare::FirewallRule.where(user: apples_user)
          expect(firewall_rules.blocked.count).to eq(0)
          expect(firewall_rules.inactive.count).to eq(2)
          
          firewall_rules.each do |rule|
            expect(rule.unblocked_at).to be_present
            expect(rule.blocked_at).to be_nil
          end
        end
      end
    end

    context "when user has never been blocked" do
      it "remains unblocked (no action taken)" do
        Timecop.freeze(UTC.parse("2025-08-02 10:00:00")) do
          # No firewall records exist
          expect(apples_user.firewall).to be_nil
          
          # Run monitor worker - should not attempt to unblock
          subject.perform(zone_id)
          Sidekiq::Worker.drain_all
          
          # Still no firewall records
          expect(apples_user.firewall).to be_nil
        end
      end
    end
    
    context "when blocked user adds new domain" do
      before do
        # First block the user by exceeding limit
        Timecop.freeze(UTC.parse("2025-08-01 10:00:00")) do
          # Mock successful blocking response
          mock_block_response = {
            result: { operation_id: "initial_block_123" },
            success: true,
            errors: [],
            messages: []
          }
          
          firewall_service = instance_double(Cloudflare::FirewallService)
          allow(Cloudflare::FirewallService).to receive(:new).and_return(firewall_service)
          allow(firewall_service).to receive(:block_domains).and_return(
            mock_api_response(mock_block_response)
          )
          allow(firewall_service).to receive(:search_blocked_domains).and_return(
            {
              "www.example.com" => "rule_www_initial",
              "apples.example.com" => "rule_apples_initial"
            }
          )
          
          subject.perform(zone_id)
          Sidekiq::Worker.drain_all
          
          # Verify user was blocked
          expect(apples_user.firewall).to be_blocked
          expect(Cloudflare::FirewallRule.where(user: apples_user).blocked.count).to eq(2)
        end
      end
      
      it "blocks the new domain when user is already over limit" do
        Timecop.freeze(UTC.parse("2025-08-02 10:00:00")) do
          # Create a new domain for the already blocked user
          new_website = create(:website, user: apples_user, name: "new-site")
          new_domain = create(:domain, user: apples_user, domain: "new.example.com", website: new_website)
          
          # Update traffic report to include the new domain
          allow(domain_monitor).to receive(:hourly_traffic_by_host) do |args|
            {
              "example.com" => 40_000,
              "apples.example.com" => 30_000,
              "www.example.com" => 20_000,
              "new.example.com" => 5_000  # New domain traffic
            }
          end
          
          # Mock blocking only the new domain
          mock_block_response = {
            result: { operation_id: "additional_block_456" },
            success: true,
            errors: [],
            messages: []
          }
          
          firewall_service = instance_double(Cloudflare::FirewallService)
          allow(Cloudflare::FirewallService).to receive(:new).and_return(firewall_service)
          
          # Should only block the new domain (others already blocked)
          allow(firewall_service).to receive(:block_domains) do |domains|
            expect(domains.map(&:domain)).to eq(["new.example.com"])
            mock_api_response(mock_block_response)
          end
          
          allow(firewall_service).to receive(:search_blocked_domains) do |domains|
            expect(domains.map(&:domain)).to eq(["new.example.com"])
            { "new.example.com" => "rule_new_123" }
          end
          
          # Run monitor worker - should block only the new domain
          subject.perform(zone_id)
          Sidekiq::Worker.drain_all
          
          # Verify all domains are now blocked (2 original + 1 new)
          firewall_rules = Cloudflare::FirewallRule.where(user: apples_user)
          expect(firewall_rules.blocked.count).to eq(3)
          
          # Verify the new domain has a firewall rule
          new_rule = firewall_rules.find_by(domain_id: new_domain.id)
          expect(new_rule).to be_present
          expect(new_rule.status).to eq("blocked")
          expect(new_rule.cloudflare_rule_id).to eq("rule_new_123")
          
          # Firewall should remain in blocked status
          apples_user.firewall.reload
          expect(apples_user.firewall).to be_blocked
        end
      end
    end
  end
end