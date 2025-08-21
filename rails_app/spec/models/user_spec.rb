require 'rails_helper'

RSpec.describe User, type: :model do
  let(:user) { build(:user) }
  let(:atlas_service) { instance_double(Atlas::UserService) }

  before do
    allow(Atlas::UserService).to receive(:new).and_return(atlas_service)
  end

  describe 'Atlas integration' do
    describe 'after_create callback' do
      it 'calls Atlas::UserService.create with user data when user is created' do
        expect(atlas_service).to receive(:create).with(
          hash_including(
            id: anything,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
          )
        ).and_return({ 'id' => 'atlas-user-id' })

        user.save!
      end

      it 'includes the user prefix_id when calling Atlas' do
        allow(user).to receive(:prefix_id).and_return('user_abc123')
        
        expect(atlas_service).to receive(:create).with(
          hash_including(id: 'user_abc123')
        ).and_return({ 'id' => 'user_abc123' })

        user.save!
      end

      it 'includes plan_id when user has a subscription' do
        plan = create(:plan, external_id: 'plan_123')
        account = create(:account)
        subscription = create(:subscription, plan: plan, account: account)
        user_with_plan = build(:user)
        allow(user_with_plan).to receive(:owned_account).and_return(account)
        allow(account).to receive_message_chain(:payment_processor, :subscription).and_return(subscription)

        expect(atlas_service).to receive(:create).with(
          hash_including(
            plan_id: 'plan_123'
          )
        ).and_return({ 'id' => 'atlas-user-id' })

        user_with_plan.save!
      end

      it 'includes org_id when user has an owned_account' do
        user_with_account = build(:user)
        account = create(:account)
        user_with_account.owned_account = account

        expect(atlas_service).to receive(:create).with(
          hash_including(
            org_id: account.prefix_id
          )
        ).and_return({ 'id' => 'atlas-user-id' })

        user_with_account.save!
      end

      context 'when Atlas service fails' do
        it 'logs the error but does not prevent user creation' do
          error_message = 'Atlas service unavailable'
          allow(atlas_service).to receive(:create).and_raise(Atlas::BaseService::Error, error_message)
          
          expect(Rails.logger).to receive(:error).with(/Failed to sync user to Atlas.*#{error_message}/)
          
          expect { user.save! }.not_to raise_error
          expect(user).to be_persisted
        end

        it 'rescues from connection errors gracefully' do
          allow(atlas_service).to receive(:create).and_raise(Atlas::BaseService::ServerError, 'Connection timeout')
          
          expect(Rails.logger).to receive(:error)
          expect { user.save! }.not_to raise_error
        end
      end
    end

    describe 'after_update callback' do
      let(:existing_user) { create(:user) }

      before do
        # Clear the create expectation from the initial save
        allow(atlas_service).to receive(:create).and_return({ 'id' => 'atlas-user-id' })
      end

      it 'calls Atlas::UserService.update when user attributes change' do
        expect(atlas_service).to receive(:update).with(
          existing_user.prefix_id,
          hash_including(
            email: 'newemail@example.com',
            first_name: existing_user.first_name,
            last_name: existing_user.last_name
          )
        ).and_return({ 'id' => existing_user.prefix_id })

        existing_user.update!(email: 'newemail@example.com')
      end

      it 'updates plan_id when subscription changes' do
        new_plan = create(:plan, external_id: 'new_plan_456')
        account = create(:account)
        existing_user.owned_account = account
        new_subscription = create(:subscription, plan: new_plan, account: account)
        allow(account).to receive_message_chain(:payment_processor, :subscription).and_return(new_subscription)
        
        expect(atlas_service).to receive(:update).with(
          existing_user.prefix_id,
          hash_including(plan_id: 'new_plan_456')
        ).and_return({ 'id' => existing_user.prefix_id })

        existing_user.touch # Trigger the callback
      end

      it 'does not call Atlas when non-synced attributes change' do
        expect(atlas_service).not_to receive(:update)
        
        existing_user.update!(updated_at: Time.current, announcements_read_at: Time.current)
      end

      context 'when Atlas service fails' do
        it 'logs the error but does not prevent user update' do
          error_message = 'Atlas update failed'
          allow(atlas_service).to receive(:update).and_raise(Atlas::BaseService::Error, error_message)
          
          expect(Rails.logger).to receive(:error).with(/Failed to sync user update to Atlas.*#{error_message}/)
          
          expect { existing_user.update!(email: 'newemail@example.com') }.not_to raise_error
          expect(existing_user.reload.email).to eq('newemail@example.com')
        end
      end
    end

    describe 'before_destroy callback' do
      let(:existing_user) { create(:user) }

      before do
        # Clear the create expectation from the initial save
        allow(atlas_service).to receive(:create).and_return({ 'id' => 'atlas-user-id' })
      end

      it 'calls Atlas::UserService.destroy when user is deleted' do
        expect(atlas_service).to receive(:destroy).with(existing_user.prefix_id)
          .and_return({ 'success' => true })

        existing_user.destroy
      end

      context 'when Atlas service fails' do
        it 'logs the error but still deletes the user' do
          error_message = 'Atlas delete failed'
          allow(atlas_service).to receive(:destroy).and_raise(Atlas::BaseService::NotFoundError, error_message)
          
          expect(Rails.logger).to receive(:error).with(/Failed to delete user from Atlas.*#{error_message}/)
          
          expect { existing_user.destroy }.not_to raise_error
          expect(User.exists?(existing_user.id)).to be false
        end

        it 'handles user already deleted in Atlas gracefully' do
          allow(atlas_service).to receive(:destroy).and_raise(Atlas::BaseService::NotFoundError, 'User not found')
          
          expect(Rails.logger).to receive(:warn).with(/User.*not found in Atlas, may have been already deleted/)
          
          expect { existing_user.destroy }.not_to raise_error
        end
      end
    end

    describe 'Atlas sync methods' do
      describe '#atlas_user_data' do
        it 'returns formatted user data for Atlas' do
          user.save!
          data = user.atlas_user_data
          
          expect(data).to include(
            id: user.prefix_id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
          )
        end

        it 'includes org_id when account exists' do
          account = create(:account)
          user_with_account = create(:user, owned_account: account)
          
          data = user_with_account.atlas_user_data
          expect(data[:org_id]).to eq(account.prefix_id)
        end

        it 'includes plan_id when subscription exists' do
          plan = create(:plan, external_id: 'plan_789')
          account = create(:account)
          subscription = create(:subscription, plan: plan, account: account)
          user_with_plan = create(:user, owned_account: account)
          allow(account).to receive_message_chain(:payment_processor, :subscription).and_return(subscription)
          
          data = user_with_plan.atlas_user_data
          expect(data[:plan_id]).to eq('plan_789')
        end
      end

      describe '#sync_to_atlas' do
        it 'manually syncs user to Atlas' do
          user.save!
          
          expect(atlas_service).to receive(:update).with(
            user.prefix_id,
            hash_including(
              id: user.prefix_id,
              email: user.email
            )
          ).and_return({ 'id' => user.prefix_id })
          
          user.sync_to_atlas
        end
      end

      describe '#sync_required?' do
        let(:existing_user) { create(:user) }

        it 'returns true when email changes' do
          existing_user.email = 'new@example.com'
          expect(existing_user.sync_required?).to be true
        end

        it 'returns true when name changes' do
          existing_user.first_name = 'NewName'
          expect(existing_user.sync_required?).to be true
        end

        it 'returns false when only timestamps change' do
          existing_user.updated_at = Time.current
          expect(existing_user.sync_required?).to be false
        end

        it 'returns false when only non-synced attributes change' do
          existing_user.announcements_read_at = Time.current
          existing_user.preferences = { theme: 'dark' }
          expect(existing_user.sync_required?).to be false
        end
      end
    end
  end

  describe 'associations' do
    it { should have_one(:owned_account).class_name('Account').with_foreign_key('owner_id').dependent(:destroy) }
    it { should have_one(:payment_processor).through(:owned_account) }
    it { should have_one(:subscription).through(:payment_processor) }
    it { should have_one(:plan).through(:subscription) }
    it { should have_many(:plan_limits).through(:plan) }
    it { should have_many(:projects).through(:owned_account) }
    it { should have_many(:websites).through(:projects) }
  end

  describe 'validations' do
    it { should validate_presence_of(:name) }
  end
end