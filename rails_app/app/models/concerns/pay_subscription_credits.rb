# frozen_string_literal: true

module PaySubscriptionCredits
  extend ActiveSupport::Concern

  included do
    after_commit :handle_subscription_created, on: :create
    after_commit :handle_subscription_updated, on: :update
  end

  private

  def handle_subscription_created
    return unless should_allocate_credits?

    Credits::ResetPlanCreditsWorker.perform_async(id)
  end

  def handle_subscription_updated
    return unless should_allocate_credits?
    return unless renewal_or_plan_change?

    Credits::ResetPlanCreditsWorker.perform_async(id, previous_plan_id: previous_plan_id_for_change)
  end

  def should_allocate_credits?
    return false unless customer&.owner.is_a?(Account)
    return false unless active?
    true
  end

  def renewal_or_plan_change?
    saved_change_to_current_period_start? || saved_change_to_processor_plan?
  end

  def previous_plan_id_for_change
    return nil unless saved_change_to_processor_plan?

    old_processor_plan = saved_change_to_processor_plan.first
    return nil if old_processor_plan.blank?

    Plan.find_by(fake_processor_id: old_processor_plan)&.id ||
      Plan.find_by(name: old_processor_plan)&.id ||
      Plan.find_by(stripe_id: old_processor_plan)&.id
  end
end
