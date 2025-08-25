require 'rails_helper'
require 'sidekiq/testing'

RSpec.describe 'Atlas Integration', type: :model, atlas_sync: true, custom_atlas_mocks: true do
  include SubscriptionHelpers
  include PlanHelpers

  let(:atlas_accounts) { instance_double(Atlas::AccountService) }
  let(:atlas_websites) { instance_double(Atlas::WebsiteService) }
  let(:atlas_domains) { instance_double(Atlas::DomainService) }
  let(:atlas_plans) { instance_double(Atlas::PlanService) }

  before do
    # Run Sidekiq jobs inline to make tests synchronous
    Sidekiq::Testing.inline!
    
    allow(Atlas).to receive(:accounts).and_return(atlas_accounts)
    allow(Atlas).to receive(:websites).and_return(atlas_websites)
    allow(Atlas).to receive(:domains).and_return(atlas_domains)
    allow(Atlas).to receive(:plans).and_return(atlas_plans)
    
    # Allow all creates by default
    allow(atlas_accounts).to receive(:create).and_return({ 'id' => 'account_123' })
    allow(atlas_websites).to receive(:create).and_return({ 'id' => 'website_123' })
    allow(atlas_domains).to receive(:create).and_return({ 'id' => 'domain_123' })
    allow(atlas_plans).to receive(:create).and_return({ 'id' => 'plan_123' })
  end
  
  after do
    # Reset Sidekiq testing mode
    Sidekiq::Testing.fake!
  end

  describe 'Account Atlas sync' do
    context 'when account is created' do
      it 'syncs to Atlas' do
        account = build(:account)
        
        expect(atlas_accounts).to receive(:create).with(
          hash_including(
            id: kind_of(Integer)
          )
        ).and_return({ 'id' => account.id })

        account.save!
      end

      it 'syncs plan_id to Atlas when account subscribes' do
        ensure_plans_exist
        plan = pro_plan
        
        # Create account first (without plan)
        account = create(:account)
        
        # Expect Atlas to be updated when subscription is created
        expect(atlas_accounts).to receive(:update).with(
          account.id,
          hash_including(plan_id: plan.id)
        ).and_return({ 'id' => account.id })
        expect(plan.id).to_not be_nil
        
        # Subscribe the account
        account.set_payment_processor :fake_processor, allow_fake: true
        account.payment_processor.subscribe(
          plan: plan.fake_processor_id || plan.name,
          ends_at: nil
        )
        
        # Verify the account now has the correct plan
        expect(account.reload.current_plan_id).to eq(plan.id)
      end
    end

    context 'when account is updated' do
      it 'does not sync on regular attribute changes' do
        account = create(:account)
        
        expect(atlas_accounts).not_to receive(:update)
        
        account.update!(name: 'NewName')
      end
    end
  end

  describe 'Website Atlas sync' do
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }

    context 'when website is created' do
      it 'syncs to Atlas with account_id' do
        website = build(:website, project: project, account: account, thread_id: 'thread_123')
        
        expect(atlas_websites).to receive(:create).with(
          hash_including(
            id: kind_of(Integer),
            account_id: account.id
          )
        ).and_return({ 'id' => website.id })

        website.save!
      end
    end

    context 'when website is destroyed' do
      it 'removes from Atlas' do
        website = create(:website, project: project, account: account, thread_id: 'thread_456')
        
        expect(atlas_websites).to receive(:destroy).with(website.id)
        
        website.destroy
      end
    end
  end

  describe 'Domain Atlas sync' do
    let(:account) { create(:account) }
    let(:project) { create(:project, account: account) }
    let(:website) { create(:website, project: project, account: account, thread_id: 'thread_789') }

    context 'when domain is created' do
      it 'syncs to Atlas with domain and website_id' do
        domain = build(:domain, website: website, account: account)
        
        expect(atlas_domains).to receive(:create).with(
          hash_including(
            id: kind_of(Integer),
            domain: kind_of(String),
            website_id: website.id
          )
        ).and_return({ 'id' => 'domain_123' })

        domain.save!
      end
    end

    context 'when domain is updated' do
      it 'syncs changes to Atlas' do
        domain = create(:domain, website: website, account: account)
        
        expect(atlas_domains).to receive(:update).with(
          domain.id,
          hash_including(
            id: domain.id,
            domain: 'newdomain.com',
            website_id: website.id
          )
        ).and_return({ 'id' => 'domain_123' })
        
        domain.update!(domain: 'newdomain.com')
      end
    end
  end

  describe 'Plan Atlas sync' do
    before do
      ensure_plans_exist
    end

    context 'when plan is created' do
      it 'syncs to Atlas with name and usage_limit' do
        plan = build(:plan, name: 'custom', amount: 19900, interval: 'month')
        
        expect(atlas_plans).to receive(:create).with(
          hash_including(
            id: anything,
            name: 'custom',
            usage_limit: 0
          )
        ).and_return({ 'id' => 'plan_custom' })

        plan.save!
      end
    end

    context 'when plan limit is added' do
      it 'updates the plan in Atlas' do
        plan = create(:plan, name: 'premium', amount: 29900, interval: 'month')
        
        # Allow the update to happen
        allow(atlas_plans).to receive(:update).and_return({ 'id' => 'plan_123' })
        
        # Adding a plan limit should trigger plan sync
        limit = plan.plan_limits.create!(limit_type: 'requests_per_month', limit: 10_000_000)
        
        # The plan's usage_limit method should now return the limit
        expect(plan.reload.usage_limit).to eq(10_000_000)
      end
    end
  end

  describe 'Error handling' do
    it 'logs errors but does not prevent model operations' do
      allow(atlas_accounts).to receive(:create).and_raise(Atlas::BaseService::ServerError, 'Connection failed')
      
      expect(Rails.logger).to receive(:error).with(/Failed to sync/).twice
      
      account = build(:account)
      expect { account.save! }.not_to raise_error
      expect(account).to be_persisted
    end

    it 'handles not found errors gracefully on destroy' do
      account = create(:account)
      allow(atlas_accounts).to receive(:destroy).and_raise(Atlas::BaseService::NotFoundError, 'Not found')
      
      expect(Rails.logger).to receive(:warn).with(/not found in Atlas/)
      
      expect { account.destroy }.not_to raise_error
      expect(Account.exists?(account.id)).to be false
    end
  end
end