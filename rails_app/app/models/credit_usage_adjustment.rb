# frozen_string_literal: true

# == Schema Information
#
# Table name: credit_usage_adjustments
#
#  id               :bigint           not null, primary key
#  amount           :integer          not null
#  credits_adjusted :boolean          default(FALSE), not null
#  notes            :text
#  reason           :string           not null
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  account_id       :bigint           not null
#  admin_id         :bigint           not null
#
# Indexes
#
#  index_credit_usage_adjustments_on_account_id                 (account_id)
#  index_credit_usage_adjustments_on_account_id_and_created_at  (account_id,created_at)
#  index_credit_usage_adjustments_on_admin_id                   (admin_id)
#  index_credit_usage_adjustments_on_credits_adjusted           (credits_adjusted)
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#  fk_rails_...  (admin_id => users.id)
#
class CreditUsageAdjustment < ApplicationRecord
  REASONS = %w[billing_correction customer_support usage_discrepancy test_setup other].freeze

  belongs_to :account
  belongs_to :admin, class_name: "User"

  validates :amount, presence: true, numericality: {greater_than: 0}
  validates :reason, presence: true, inclusion: {in: REASONS}

  after_create :enqueue_usage_adjustment

  private

  def enqueue_usage_adjustment
    Credits::AdjustUsageCreditsWorker.perform_async(id)
  end
end
