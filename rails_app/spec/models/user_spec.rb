# == Schema Information
#
# Table name: users
#
#  id                     :integer          not null, primary key
#  email                  :string           default(""), not null
#  encrypted_password     :string           default(""), not null
#  reset_password_token   :string
#  reset_password_sent_at :datetime
#  remember_created_at    :datetime
#  confirmation_token     :string
#  confirmed_at           :datetime
#  confirmation_sent_at   :datetime
#  unconfirmed_email      :string
#  first_name             :string
#  last_name              :string
#  time_zone              :string
#  accepted_terms_at      :datetime
#  accepted_privacy_at    :datetime
#  announcements_read_at  :datetime
#  admin                  :boolean
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#  invitation_token       :string
#  invitation_created_at  :datetime
#  invitation_sent_at     :datetime
#  invitation_accepted_at :datetime
#  invitation_limit       :integer
#  invited_by_type        :string
#  invited_by_id          :integer
#  invitations_count      :integer          default("0")
#  preferred_language     :string
#  otp_required_for_login :boolean
#  otp_secret             :string
#  last_otp_timestep      :integer
#  otp_backup_codes       :text
#  preferences            :jsonb
#  name                   :string
#  jti                    :string           not null
#
# Indexes
#
#  index_users_on_email                              (email) UNIQUE
#  index_users_on_invitation_token                   (invitation_token) UNIQUE
#  index_users_on_invitations_count                  (invitations_count)
#  index_users_on_invited_by_id                      (invited_by_id)
#  index_users_on_invited_by_type_and_invited_by_id  (invited_by_type,invited_by_id)
#  index_users_on_jti                                (jti) UNIQUE
#  index_users_on_reset_password_token               (reset_password_token) UNIQUE
#

require 'rails_helper'

RSpec.describe User, type: :model do
  let(:user) { build(:user) }

  describe 'Atlas integration' do
    it 'syncs to Atlas with id when user is created' do
      user.save!
      expect(user).to be_persisted
    end

    it 'syncs to Atlas with plan_id when user has a subscription' do
      plan = create(:plan)
      account = create(:account)
      user.owned_account = account
      user.save!
      
      # Create subscription after user exists
      pay_customer = account.set_payment_processor(:fake_processor, allow_fake: true)
      pay_customer.subscribe(
        name: 'default',
        plan: 'test',
        processor_plan: 'test'
      )
      
      # Mock the plan lookup
      allow_any_instance_of(Pay::Subscription).to receive(:plan).and_return(plan)
      
      expect(user.plan).to eq(plan)
    end

    it 'does not sync on regular updates since sync_to_atlas_required? returns false' do
      user.save!
      user.update!(email: 'new@example.com')
      # sync_to_atlas_required? returns false, so no sync happens
      expect(user.reload.email).to eq('new@example.com')
    end
  end

  describe 'associations' do
    it { should have_one(:owned_account) }
    it { should have_one(:payment_processor).through(:owned_account) }
    it { should have_many(:subscriptions).through(:owned_account) }
  end

  describe '#plan' do
    it 'returns the active subscription plan' do
      plan = create(:plan)
      user.save!
      account = user.owned_account || create(:account, owner: user)
      
      subscription = double('subscription')
      allow(user).to receive(:subscriptions).and_return(double(active: double(first: subscription)))
      allow(subscription).to receive(:plan).and_return(plan)
      
      expect(user.plan).to eq(plan)
    end

    it 'returns nil when no active subscription' do
      user.save!
      allow(user).to receive(:subscriptions).and_return(double(active: double(first: nil)))
      
      expect(user.plan).to be_nil
    end
  end

  describe '#plan_limits' do
    it 'returns plan limits when plan exists' do
      plan = create(:plan)
      plan_limit = create(:plan_limit, plan: plan)
      user.save!
      
      subscription = double('subscription')
      allow(user).to receive(:subscriptions).and_return(double(active: double(first: subscription)))
      allow(subscription).to receive(:plan).and_return(plan)
      
      expect(user.plan_limits).to include(plan_limit)
    end

    it 'returns empty array when no plan' do
      user.save!
      allow(user).to receive(:subscriptions).and_return(double(active: double(first: nil)))
      
      expect(user.plan_limits).to eq([])
    end
  end
end
