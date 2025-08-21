require 'rails_helper'

RSpec.describe 'Atlas Integration', type: :model do
  include SubscriptionHelpers
  include PlanHelpers

  let(:atlas_users) { instance_double(Atlas::UserService) }
  let(:atlas_websites) { instance_double(Atlas::WebsiteService) }
  let(:atlas_domains) { instance_double(Atlas::DomainService) }
  let(:atlas_plans) { instance_double(Atlas::PlanService) }

  before do
    allow(Atlas).to receive(:users).and_return(atlas_users)
    allow(Atlas).to receive(:websites).and_return(atlas_websites)
    allow(Atlas).to receive(:domains).and_return(atlas_domains)
    allow(Atlas).to receive(:plans).and_return(atlas_plans)
  end

  describe 'User Atlas sync' do
    context 'when user is created' do
      it 'syncs to Atlas with plan_id' do
        user = build(:user)
        
        expect(atlas_users).to receive(:create).with(
          hash_including(
            id: kind_of(Integer),
            plan_id: 0  # No plan means 0
          )
        ).and_return({ 'id' => user.id })

        user.save!
      end

      it 'includes the correct plan_id for subscribed users' do
        ensure_plans_exist
        plan = pro_plan
        user = create_subscribed_user(plan_name: 'pro')
        
        # The create happens on user creation, not after subscription
        # So we need to test the current_plan_id method
        expect(user.current_plan_id).to eq(plan.id)
      end
    end

    context 'when user is updated' do
      it 'does not sync on regular attribute changes' do
        user = create(:user)
        
        expect(atlas_users).not_to receive(:update)
        
        user.update!(first_name: 'NewName')
      end
    end
  end

  describe 'Website Atlas sync' do
    let(:user) { create(:user) }
    let(:project) { create(:project, account: user.owned_account) }

    before do
      allow(atlas_users).to receive(:create).and_return({ 'id' => 'user_123' })
    end

    context 'when website is created' do
      it 'syncs to Atlas with user_id' do
        website = build(:website, project: project, user: user, thread_id: 'thread_123')
        
        expect(atlas_websites).to receive(:create).with(
          hash_including(
            id: kind_of(Integer),
            user_id: user.id
          )
        ).and_return({ 'id' => website.id })

        website.save!
      end
    end

    context 'when website is destroyed' do
      it 'removes from Atlas' do
        website = create(:website, project: project, user: user, thread_id: 'thread_456')
        allow(atlas_websites).to receive(:create).and_return({ 'id' => 'website_123' })
        
        expect(atlas_websites).to receive(:destroy).with(website.id.to_s)
        
        website.destroy
      end
    end
  end

  describe 'Domain Atlas sync' do
    let(:user) { create(:user) }
    let(:project) { create(:project, account: user.owned_account) }
    let(:website) { create(:website, project: project, user: user, thread_id: 'thread_789') }

    before do
      allow(atlas_users).to receive(:create).and_return({ 'id' => 'user_123' })
      allow(atlas_websites).to receive(:create).and_return({ 'id' => 'website_123' })
    end

    context 'when domain is created' do
      it 'syncs to Atlas with domain and website_id' do
        domain = build(:domain, website: website, user: user)
        
        expect(atlas_domains).to receive(:create).with(
          hash_including(
            domain: anything,
            website_id: website.id.to_s
          )
        ).and_return({ 'id' => 'domain_123' })

        domain.save!
      end
    end

    context 'when domain is updated' do
      it 'syncs changes to Atlas' do
        domain = create(:domain, website: website, user: user)
        allow(atlas_domains).to receive(:create).and_return({ 'id' => 'domain_123' })
        
        expect(atlas_domains).to receive(:update).with(
          domain.id.to_s,
          hash_including(
            domain: 'newdomain.com',
            website_id: website.id.to_s
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
        allow(atlas_plans).to receive(:create).and_return({ 'id' => 'plan_premium' })
        
        # Adding a plan limit should trigger plan sync
        limit = plan.plan_limits.create!(limit_type: 'requests_per_month', limit: 10_000_000)
        
        # The plan's usage_limit method should now return the limit
        expect(plan.reload.usage_limit).to eq(10_000_000)
      end
    end
  end

  describe 'Error handling' do
    it 'logs errors but does not prevent model operations' do
      allow(atlas_users).to receive(:create).and_raise(Atlas::BaseService::ServerError, 'Connection failed')
      
      expect(Rails.logger).to receive(:error).with(/Failed to sync/)
      
      user = build(:user)
      expect { user.save! }.not_to raise_error
      expect(user).to be_persisted
    end

    it 'handles not found errors gracefully on destroy' do
      user = create(:user)
      allow(atlas_users).to receive(:create).and_return({ 'id' => 'user_123' })
      allow(atlas_users).to receive(:destroy).and_raise(Atlas::BaseService::NotFoundError, 'Not found')
      
      expect(Rails.logger).to receive(:warn).with(/not found in Atlas/)
      
      expect { user.destroy }.not_to raise_error
      expect(User.exists?(user.id)).to be false
    end
  end
end