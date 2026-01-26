# frozen_string_literal: true

# == Schema Information
#
# Table name: credit_gifts
#
#  id                :bigint           not null, primary key
#  amount            :integer          not null
#  credits_allocated :boolean          default(FALSE), not null
#  notes             :text
#  reason            :string           not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  account_id        :bigint           not null
#  admin_id          :bigint           not null
#
# Indexes
#
#  index_credit_gifts_on_account_id                 (account_id)
#  index_credit_gifts_on_account_id_and_created_at  (account_id,created_at)
#  index_credit_gifts_on_admin_id                   (admin_id)
#  index_credit_gifts_on_credits_allocated          (credits_allocated)
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#  fk_rails_...  (admin_id => users.id)
#
class CreditGift < ApplicationRecord
  REASONS = %w[customer_support promotional compensation beta_testing referral_bonus other].freeze

  belongs_to :account
  belongs_to :admin, class_name: "User"

  validates :amount, presence: true, numericality: {greater_than: 0}
  validates :reason, presence: true, inclusion: {in: REASONS}

  after_create :enqueue_credit_allocation

  private

  def enqueue_credit_allocation
    Credits::AllocateGiftCreditsWorker.perform_async(id)
  end
end
