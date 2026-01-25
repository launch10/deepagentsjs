# frozen_string_literal: true

module Credits
  # Handles customer.subscription.updated webhooks for plan changes.
  #
  # Only processes events where previous_attributes.items is present,
  # which indicates the plan/price actually changed (not just metadata, quantity, etc.)
  #
  # Usage:
  #   Pay::Webhooks.delegator.subscribe "stripe.customer.subscription.updated", Credits::PlanChangeHandler.new
  #
  class PlanChangeHandler
    def call(event)
      previous_attributes = event.data.previous_attributes

      # Only process if plan/items actually changed
      # previous_attributes will contain "items" when the price changed
      return unless previous_attributes
      return unless plan_changed?(previous_attributes)

      subscription = Pay::Subscription
        .joins(:customer)
        .find_by(pay_customers: {processor: "stripe"}, processor_id: event.data.object.id)

      return unless subscription
      return unless subscription.active?

      account = subscription.customer&.owner
      return unless account.is_a?(Account)

      # Extract the old price ID from previous_attributes
      old_price_id = extract_old_price_id(previous_attributes)
      return unless old_price_id

      # Find the old plan by Stripe price ID
      old_plan = Plan.find_by(stripe_id: old_price_id)
      return unless old_plan

      # Use Stripe event ID for idempotency (globally unique)
      Credits::ResetPlanCreditsWorker.perform_async(
        subscription.id,
        {"previous_plan_id" => old_plan.id, "stripe_event_id" => event.id}
      )
    end

    private

    def plan_changed?(previous_attributes)
      attrs = normalize(previous_attributes)
      items = attrs["items"]
      items.present?
    end

    def extract_old_price_id(previous_attributes)
      attrs = normalize(previous_attributes)

      # Stripe nests the old price under previous_attributes.items.data[0].price.id
      items = attrs["items"]
      return nil unless items

      items = normalize(items)
      items_data = items["data"]
      return nil unless items_data.is_a?(Array) && items_data.any?

      first_item = normalize(items_data.first)
      return nil unless first_item

      price = normalize(first_item["price"])
      return nil unless price

      price["id"]
    end

    # Convert to hash with string keys, handling both Hash and Stripe::StripeObject
    def normalize(obj)
      return {} if obj.nil?
      hash = obj.respond_to?(:to_hash) ? obj.to_hash : obj
      return hash unless hash.is_a?(Hash)
      hash.deep_stringify_keys
    end
  end
end
