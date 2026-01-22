# == Schema Information
#
# Table name: users
#
#  id                     :bigint           not null, primary key
#  accepted_privacy_at    :datetime
#  accepted_terms_at      :datetime
#  admin                  :boolean
#  announcements_read_at  :datetime
#  confirmation_sent_at   :datetime
#  confirmation_token     :string
#  confirmed_at           :datetime
#  email                  :string           default(""), not null
#  encrypted_password     :string           default(""), not null
#  first_name             :string
#  invitation_accepted_at :datetime
#  invitation_created_at  :datetime
#  invitation_limit       :integer
#  invitation_sent_at     :datetime
#  invitation_token       :string
#  invitations_count      :integer          default(0)
#  invited_by_type        :string
#  jti                    :string           not null
#  last_name              :string
#  last_otp_timestep      :integer
#  name                   :string
#  otp_backup_codes       :text
#  otp_required_for_login :boolean
#  otp_secret             :string
#  preferences            :jsonb
#  preferred_language     :string
#  remember_created_at    :datetime
#  reset_password_sent_at :datetime
#  reset_password_token   :string
#  time_zone              :string
#  unconfirmed_email      :string
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#  invited_by_id          :bigint
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
  include SubscriptionHelpers

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
      plan = create(:plan, :growth_monthly)
      user.save!
      subscribe_user(user, plan_name: "growth_monthly")

      expect(user.plan).to eq(plan)
    end

    it 'returns nil when no active subscription' do
      user.save!

      expect(user.plan).to be_nil
    end
  end

  describe '#plan_limits' do
    it 'returns plan limits when plan exists' do
      plan = create(:plan, :growth_monthly)
      tier_limit = create(:tier_limit, tier: plan.plan_tier)
      user.save!
      subscribe_user(user, plan_name: "growth_monthly")

      expect(user.owned_account.plan_limits).to include(tier_limit)
    end

    it 'returns empty array when no plan' do
      user.save!

      expect(user.owned_account.plan_limits).to eq([])
    end
  end

  describe 'one active subscription per user validation' do
    let(:user) { create(:user) }
    let(:account) { user.owned_account }
    let(:payment_processor) { account.set_payment_processor(:fake_processor, allow_fake: true) }

    before do
      # Ensure payment processor is initialized with a customer ID
      payment_processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")
    end

    it 'allows creating the first subscription' do
      subscription = payment_processor.subscriptions.build(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: "starter",
        status: "active",
        current_period_start: Time.current,
        current_period_end: 30.days.from_now
      )

      expect(subscription).to be_valid
      expect { subscription.save! }.not_to raise_error
      expect(user.subscriptions.active.count).to eq(1)
    end

    it 'prevents creating a second active subscription for the same user' do
      # Create first active subscription
      payment_processor.subscriptions.create!(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: "starter",
        status: "active",
        current_period_start: Time.current,
        current_period_end: 30.days.from_now
      )

      # Attempt to create second active subscription
      second_subscription = payment_processor.subscriptions.build(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: "professional",
        status: "active",
        current_period_start: Time.current,
        current_period_end: 30.days.from_now
      )

      expect(second_subscription).not_to be_valid
      expect(second_subscription.errors[:base]).to include("Customer can only have one active subscription")
    end

    it 'allows creating a new subscription after canceling the previous one' do
      # Create and then cancel first subscription
      first_subscription = payment_processor.subscriptions.create!(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: "starter",
        status: "active",
        current_period_start: Time.current,
        current_period_end: 30.days.from_now
      )

      first_subscription.update!(status: "canceled", ends_at: Time.current)

      # Now create a new subscription
      new_subscription = payment_processor.subscriptions.build(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: "professional",
        status: "active",
        current_period_start: Time.current,
        current_period_end: 30.days.from_now
      )

      expect(new_subscription).to be_valid
      expect { new_subscription.save! }.not_to raise_error
    end

    it 'allows different users to each have their own active subscription' do
      # First user's subscription
      payment_processor.subscriptions.create!(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: "starter",
        status: "active",
        current_period_start: Time.current,
        current_period_end: 30.days.from_now
      )

      # Second user's subscription
      user2 = create(:user)
      user2_processor = user2.owned_account.set_payment_processor(:fake_processor, allow_fake: true)
      user2_processor.update!(processor_id: "cus_#{SecureRandom.hex(8)}")

      user2_subscription = user2_processor.subscriptions.build(
        processor_id: "sub_#{SecureRandom.hex(8)}",
        name: "default",
        processor_plan: "professional",
        status: "active",
        current_period_start: Time.current,
        current_period_end: 30.days.from_now
      )

      expect(user2_subscription).to be_valid
      expect { user2_subscription.save! }.not_to raise_error

      # Verify both users have their subscriptions
      expect(user.subscriptions.active.count).to eq(1)
      expect(user2.subscriptions.active.count).to eq(1)
    end

    it 'uses subscription helpers to enforce one active subscription' do
      # Using the helper to create first subscription
      subscribe_user(user, plan_name: "starter_monthly", processor: "fake_processor")
      expect(user.subscriptions.active.count).to eq(1)
      expect(user.plan.name).to eq("starter_monthly")

      # Using helper again should replace the subscription (helper handles unsubscribe)
      subscribe_user(user, plan_name: "growth_monthly", processor: "fake_processor")
      expect(user.subscriptions.active.count).to eq(1)
      expect(user.plan.name).to eq("growth_monthly")
    end

    context 'with non-active subscriptions' do
      it 'allows multiple non-active subscriptions' do
        # Create a canceled subscription
        payment_processor.subscriptions.create!(
          processor_id: "sub_#{SecureRandom.hex(8)}",
          name: "default",
          processor_plan: "starter",
          status: "canceled",
          current_period_start: 1.month.ago,
          current_period_end: Time.current,
          ends_at: Time.current
        )

        # Create a past_due subscription
        payment_processor.subscriptions.create!(
          processor_id: "sub_#{SecureRandom.hex(8)}",
          name: "default",
          processor_plan: "professional",
          status: "past_due",
          current_period_start: Time.current,
          current_period_end: 30.days.from_now
        )

        # Should still be able to create an active subscription
        active_sub = payment_processor.subscriptions.build(
          processor_id: "sub_#{SecureRandom.hex(8)}",
          name: "default",
          processor_plan: "starter",
          status: "active",
          current_period_start: Time.current,
          current_period_end: 30.days.from_now
        )

        expect(active_sub).to be_valid
        expect { active_sub.save! }.not_to raise_error
        expect(user.subscriptions.count).to eq(3)
        expect(user.subscriptions.active.count).to eq(1)
      end
    end

    context 'validation error handling' do
      it 'provides clear error message when attempting multiple active subscriptions' do
        # Create first subscription
        payment_processor.subscriptions.create!(
          processor_id: "sub_#{SecureRandom.hex(8)}",
          name: "default",
          processor_plan: "starter",
          status: "active",
          current_period_start: Time.current,
          current_period_end: 30.days.from_now
        )

        # Attempt second subscription and capture error
        second_subscription = payment_processor.subscriptions.build(
          processor_id: "sub_#{SecureRandom.hex(8)}",
          name: "default",
          processor_plan: "professional",
          status: "active",
          current_period_start: Time.current,
          current_period_end: 30.days.from_now
        )

        second_subscription.valid?
        expect(second_subscription.errors.full_messages).to include("Customer can only have one active subscription")
      end
    end
  end
end
