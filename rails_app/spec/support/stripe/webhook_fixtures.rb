# frozen_string_literal: true

# Comprehensive Stripe webhook event fixtures for testing subscription lifecycle.
#
# Usage:
#   include StripeWebhookFixtures
#
#   event = invoice_paid_event(
#     subscription_id: subscription.processor_id,
#     customer_id: customer.processor_id,
#     billing_reason: "subscription_cycle"
#   )
#
#   Pay::Webhooks.instrument(event: event, type: event.type)
#
module StripeWebhookFixtures
  extend ActiveSupport::Concern

  included do
    # Make methods available as both instance and module methods
  end

  module_function

  def build_stripe_event(type:, data:, id: nil, created: nil, account: nil)
    Stripe::Event.construct_from({
      id: id || "evt_test_#{SecureRandom.hex(8)}",
      type: type,
      created: created || Time.current.to_i,
      data: data,
      livemode: false,
      pending_webhooks: 0,
      request: {id: "req_#{SecureRandom.hex(8)}", idempotency_key: nil},
      account: account
    }.compact)
  end

  # ===========================================================================
  # SUBSCRIPTION CREATED
  # ===========================================================================

  def subscription_created_event(
    subscription_id: "sub_#{SecureRandom.hex(8)}",
    customer_id: "cus_#{SecureRandom.hex(8)}",
    price_id: "price_growth_monthly",
    status: "active",
    unit_amount: 2900,
    quantity: 1,
    metadata: {},
    price_metadata: {},
    trial_end: nil,
    trial_start: nil,
    current_period_start: Time.current,
    current_period_end: 1.month.from_now
  )
    build_stripe_event(
      type: "stripe.customer.subscription.created",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          status: status,
          unit_amount: unit_amount,
          quantity: quantity,
          metadata: metadata,
          price_metadata: price_metadata,
          trial_end: trial_end,
          trial_start: trial_start,
          current_period_start: current_period_start,
          current_period_end: current_period_end
        )
      }
    )
  end

  # ===========================================================================
  # SUBSCRIPTION UPDATED - Various scenarios
  # ===========================================================================

  # Period advanced after successful renewal payment
  def subscription_renewed_event(
    subscription_id:,
    customer_id:,
    old_period_start:, old_period_end:, new_period_start:, new_period_end:, price_id: "price_growth_monthly",
    unit_amount: 2900,
    old_invoice_id: "in_old_#{SecureRandom.hex(8)}",
    new_invoice_id: "in_new_#{SecureRandom.hex(8)}"
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          unit_amount: unit_amount,
          current_period_start: new_period_start,
          current_period_end: new_period_end,
          latest_invoice: new_invoice_id
        ),
        previous_attributes: {
          current_period_start: old_period_start.to_i,
          current_period_end: old_period_end.to_i,
          latest_invoice: old_invoice_id
        }
      }
    )
  end

  # Plan changed (upgrade or downgrade)
  def subscription_plan_changed_event(
    subscription_id:,
    customer_id:,
    old_price_id:,
    new_price_id:,
    old_unit_amount:,
    new_unit_amount:,
    old_metadata: {},
    new_metadata: {},
    quantity: 1,
    current_period_start: Time.current,
    current_period_end: 1.month.from_now
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: new_price_id,
          unit_amount: new_unit_amount,
          quantity: quantity,
          price_metadata: new_metadata,
          current_period_start: current_period_start,
          current_period_end: current_period_end
        ),
        previous_attributes: {
          items: {
            data: [{
              id: "si_old_#{SecureRandom.hex(4)}",
              price: {
                id: old_price_id,
                unit_amount: old_unit_amount,
                metadata: old_metadata
              },
              quantity: quantity
            }]
          }
        }
      }
    )
  end

  # Status changed (e.g., active -> past_due, trialing -> active)
  def subscription_status_changed_event(
    subscription_id:,
    customer_id:,
    old_status:,
    new_status:,
    price_id: "price_growth_monthly"
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          status: new_status
        ),
        previous_attributes: {
          status: old_status
        }
      }
    )
  end

  # Quantity changed (per-seat pricing)
  def subscription_quantity_changed_event(
    subscription_id:,
    customer_id:,
    price_id:,
    old_quantity:,
    new_quantity:,
    unit_amount: 2900
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          unit_amount: unit_amount,
          quantity: new_quantity
        ),
        previous_attributes: {
          items: {
            data: [{
              id: "si_#{SecureRandom.hex(4)}",
              price: {id: price_id, unit_amount: unit_amount},
              quantity: old_quantity
            }]
          },
          quantity: old_quantity
        }
      }
    )
  end

  # Metadata changed (no billing impact)
  def subscription_metadata_changed_event(
    subscription_id:,
    customer_id:,
    old_metadata:,
    new_metadata:,
    price_id: "price_growth_monthly"
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          metadata: new_metadata
        ),
        previous_attributes: {
          metadata: old_metadata
        }
      }
    )
  end

  # Default payment method changed
  def subscription_payment_method_changed_event(
    subscription_id:,
    customer_id:,
    old_payment_method_id:,
    new_payment_method_id:,
    price_id: "price_growth_monthly"
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          default_payment_method: new_payment_method_id
        ),
        previous_attributes: {
          default_payment_method: old_payment_method_id
        }
      }
    )
  end

  # Subscription paused
  def subscription_paused_event(
    subscription_id:,
    customer_id:,
    behavior: "void",
    resumes_at: nil,
    price_id: "price_growth_monthly"
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          pause_collection: {behavior: behavior, resumes_at: resumes_at&.to_i}
        ),
        previous_attributes: {
          pause_collection: nil
        }
      }
    )
  end

  # Subscription resumed from pause
  def subscription_resumed_event(
    subscription_id:,
    customer_id:,
    previous_behavior: "void",
    price_id: "price_growth_monthly"
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          pause_collection: nil
        ),
        previous_attributes: {
          pause_collection: {behavior: previous_behavior, resumes_at: nil}
        }
      }
    )
  end

  # Cancellation scheduled (cancel at period end)
  def subscription_cancel_scheduled_event(
    subscription_id:,
    customer_id:,
    cancel_at:,
    feedback: nil,
    price_id: "price_growth_monthly"
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          cancel_at: cancel_at.to_i,
          cancel_at_period_end: true,
          canceled_at: Time.current.to_i,
          cancellation_details: {
            comment: nil,
            feedback: feedback,
            reason: "cancellation_requested"
          }
        ),
        previous_attributes: {
          cancel_at: nil,
          cancel_at_period_end: false,
          canceled_at: nil,
          cancellation_details: {comment: nil, feedback: nil, reason: nil}
        }
      }
    )
  end

  # Cancellation reversed (user changed their mind)
  def subscription_cancel_reversed_event(
    subscription_id:,
    customer_id:,
    previous_cancel_at:,
    price_id: "price_growth_monthly"
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          cancel_at: nil,
          cancel_at_period_end: false,
          canceled_at: nil,
          cancellation_details: {comment: nil, feedback: nil, reason: nil}
        ),
        previous_attributes: {
          cancel_at: previous_cancel_at.to_i,
          cancel_at_period_end: true,
          canceled_at: Time.current.to_i,
          cancellation_details: {comment: nil, feedback: "too_expensive", reason: "cancellation_requested"}
        }
      }
    )
  end

  # Discount/coupon applied
  def subscription_discount_applied_event(
    subscription_id:,
    customer_id:,
    coupon_id:,
    percent_off: nil,
    amount_off: nil,
    duration: "repeating",
    duration_in_months: 3,
    price_id: "price_growth_monthly"
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          discount: {
            id: "di_#{SecureRandom.hex(8)}",
            coupon: {
              id: coupon_id,
              amount_off: amount_off,
              percent_off: percent_off,
              duration: duration,
              duration_in_months: duration_in_months
            },
            start: Time.current.to_i,
            end: duration_in_months ? duration_in_months.months.from_now.to_i : nil
          }
        ),
        previous_attributes: {
          discount: nil
        }
      }
    )
  end

  # Discount removed
  def subscription_discount_removed_event(
    subscription_id:,
    customer_id:,
    previous_coupon_id:,
    price_id: "price_growth_monthly"
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          discount: nil
        ),
        previous_attributes: {
          discount: {
            id: "di_#{SecureRandom.hex(8)}",
            coupon: {id: previous_coupon_id}
          }
        }
      }
    )
  end

  # Schedule attached (for future plan change)
  def subscription_schedule_attached_event(
    subscription_id:,
    customer_id:,
    schedule_id: "sub_sched_#{SecureRandom.hex(8)}",
    price_id: "price_growth_monthly"
  )
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          schedule: schedule_id
        ),
        previous_attributes: {
          schedule: nil
        }
      }
    )
  end

  # ===========================================================================
  # SUBSCRIPTION DELETED
  # ===========================================================================

  def subscription_deleted_event(
    subscription_id:,
    customer_id:,
    price_id: "price_growth_monthly",
    ended_at: Time.current,
    canceled_at: nil
  )
    build_stripe_event(
      type: "stripe.customer.subscription.deleted",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          status: "canceled",
          ended_at: ended_at.to_i,
          canceled_at: canceled_at&.to_i || ended_at.to_i
        )
      }
    )
  end

  # ===========================================================================
  # TRIAL EVENTS
  # ===========================================================================

  def subscription_trial_will_end_event(
    subscription_id:,
    customer_id:,
    trial_end:,
    trial_start: nil,
    price_id: "price_growth_monthly"
  )
    trial_start ||= trial_end - 14.days
    build_stripe_event(
      type: "stripe.customer.subscription.trial_will_end",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          status: "trialing",
          trial_end: trial_end.to_i,
          trial_start: trial_start.to_i,
          current_period_end: trial_end.to_i,
          current_period_start: trial_start.to_i
        )
      }
    )
  end

  # Trial ended and subscription became active
  def subscription_trial_ended_event(
    subscription_id:,
    customer_id:,
    trial_end:,
    trial_start: nil,
    price_id: "price_growth_monthly",
    new_period_end: nil
  )
    trial_start ||= trial_end - 14.days
    new_period_end ||= trial_end + 1.month
    build_stripe_event(
      type: "stripe.customer.subscription.updated",
      data: {
        object: build_subscription_object(
          id: subscription_id,
          customer: customer_id,
          price_id: price_id,
          status: "active",
          trial_end: trial_end.to_i,
          trial_start: trial_start.to_i,
          current_period_start: trial_end.to_i,
          current_period_end: new_period_end.to_i
        ),
        previous_attributes: {
          status: "trialing",
          current_period_start: trial_start.to_i,
          current_period_end: trial_end.to_i
        }
      }
    )
  end

  # ===========================================================================
  # INVOICE EVENTS
  # ===========================================================================

  # Invoice paid - the primary signal that payment succeeded
  # billing_reason values:
  #   - "subscription_create" : First invoice for new subscription
  #   - "subscription_cycle"  : Renewal payment
  #   - "subscription_update" : Proration from plan change
  #   - "subscription_threshold" : Usage-based billing threshold
  #   - "manual" : Manually created invoice
  def invoice_paid_event(
    subscription_id:, customer_id:, billing_reason:, invoice_id: "in_#{SecureRandom.hex(8)}",
    amount: 2900,
    currency: "usd",
    lines: nil,
    charge_id: "ch_#{SecureRandom.hex(8)}",
    payment_intent_id: "pi_#{SecureRandom.hex(8)}",
    period_start: 1.month.ago,
    period_end: Time.current
  )
    build_stripe_event(
      type: "stripe.invoice.paid",
      data: {
        object: build_invoice_object(
          id: invoice_id,
          subscription: subscription_id,
          customer: customer_id,
          billing_reason: billing_reason,
          amount_due: amount,
          amount_paid: amount,
          amount_remaining: 0,
          currency: currency,
          paid: true,
          status: "paid",
          charge: charge_id,
          payment_intent: payment_intent_id,
          lines: lines,
          period_start: period_start,
          period_end: period_end
        )
      }
    )
  end

  # Invoice payment failed
  def invoice_payment_failed_event(
    subscription_id:, customer_id:, invoice_id: "in_#{SecureRandom.hex(8)}",
    billing_reason: "subscription_cycle",
    amount: 2900,
    attempt_count: 1,
    next_payment_attempt: 3.days.from_now,
    charge_id: "ch_#{SecureRandom.hex(8)}",
    payment_intent_id: "pi_#{SecureRandom.hex(8)}"
  )
    build_stripe_event(
      type: "stripe.invoice.payment_failed",
      data: {
        object: build_invoice_object(
          id: invoice_id,
          subscription: subscription_id,
          customer: customer_id,
          billing_reason: billing_reason,
          amount_due: amount,
          amount_paid: 0,
          amount_remaining: amount,
          paid: false,
          status: "open",
          charge: charge_id,
          payment_intent: payment_intent_id,
          attempt_count: attempt_count,
          next_payment_attempt: next_payment_attempt
        )
      }
    )
  end

  # Invoice upcoming - advance notice before renewal
  def invoice_upcoming_event(
    subscription_id:,
    customer_id:,
    next_payment_attempt:, amount: 2900,
    lines: nil
  )
    build_stripe_event(
      type: "stripe.invoice.upcoming",
      data: {
        object: build_invoice_object(
          id: nil, # Upcoming invoices have no ID yet
          subscription: subscription_id,
          customer: customer_id,
          billing_reason: "upcoming",
          amount_due: amount,
          amount_paid: 0,
          amount_remaining: amount,
          paid: false,
          status: "draft",
          charge: nil,
          payment_intent: nil,
          lines: lines,
          next_payment_attempt: next_payment_attempt
        )
      }
    )
  end

  # Invoice created
  def invoice_created_event(
    subscription_id:, customer_id:, billing_reason:, invoice_id: "in_#{SecureRandom.hex(8)}",
    amount: 2900,
    status: "draft"
  )
    build_stripe_event(
      type: "stripe.invoice.created",
      data: {
        object: build_invoice_object(
          id: invoice_id,
          subscription: subscription_id,
          customer: customer_id,
          billing_reason: billing_reason,
          amount_due: amount,
          amount_paid: 0,
          amount_remaining: amount,
          paid: false,
          status: status
        )
      }
    )
  end

  # Invoice finalized (ready for payment)
  def invoice_finalized_event(
    invoice_id:,
    subscription_id:,
    customer_id:,
    billing_reason:,
    amount: 2900
  )
    build_stripe_event(
      type: "stripe.invoice.finalized",
      data: {
        object: build_invoice_object(
          id: invoice_id,
          subscription: subscription_id,
          customer: customer_id,
          billing_reason: billing_reason,
          amount_due: amount,
          amount_paid: 0,
          amount_remaining: amount,
          paid: false,
          status: "open"
        )
      }
    )
  end

  # Invoice payment action required (SCA/3DS)
  def invoice_payment_action_required_event(
    invoice_id:,
    subscription_id:,
    customer_id:,
    payment_intent_id:, amount: 2900
  )
    build_stripe_event(
      type: "stripe.invoice.payment_action_required",
      data: {
        object: build_invoice_object(
          id: invoice_id,
          subscription: subscription_id,
          customer: customer_id,
          billing_reason: "subscription_cycle",
          amount_due: amount,
          amount_paid: 0,
          amount_remaining: amount,
          paid: false,
          status: "open",
          payment_intent: payment_intent_id
        )
      }
    )
  end

  # ===========================================================================
  # CHARGE EVENTS
  # ===========================================================================

  def charge_succeeded_event(
    customer_id:, charge_id: "ch_#{SecureRandom.hex(8)}",
    invoice_id: nil,
    amount: 2900,
    currency: "usd",
    payment_intent_id: "pi_#{SecureRandom.hex(8)}",
    payment_method_id: "pm_#{SecureRandom.hex(8)}"
  )
    build_stripe_event(
      type: "stripe.charge.succeeded",
      data: {
        object: build_charge_object(
          id: charge_id,
          customer: customer_id,
          invoice: invoice_id,
          amount: amount,
          currency: currency,
          captured: true,
          paid: true,
          status: "succeeded",
          payment_intent: payment_intent_id,
          payment_method: payment_method_id
        )
      }
    )
  end

  def charge_failed_event(
    customer_id:, charge_id: "ch_#{SecureRandom.hex(8)}",
    invoice_id: nil,
    amount: 2900,
    failure_code: "card_declined",
    failure_message: "Your card was declined.",
    decline_code: "generic_decline",
    payment_intent_id: "pi_#{SecureRandom.hex(8)}"
  )
    build_stripe_event(
      type: "stripe.charge.failed",
      data: {
        object: build_charge_object(
          id: charge_id,
          customer: customer_id,
          invoice: invoice_id,
          amount: amount,
          captured: false,
          paid: false,
          status: "failed",
          failure_code: failure_code,
          failure_message: failure_message,
          payment_intent: payment_intent_id,
          outcome: {
            network_status: "declined_by_network",
            reason: decline_code,
            risk_level: "normal",
            seller_message: "The bank did not return any further details with this decline.",
            type: "issuer_declined"
          }
        )
      }
    )
  end

  def charge_refunded_event(
    charge_id:,
    customer_id:,
    amount:, amount_refunded:, invoice_id: nil,
    refund_id: "re_#{SecureRandom.hex(8)}",
    refund_reason: "requested_by_customer"
  )
    build_stripe_event(
      type: "stripe.charge.refunded",
      data: {
        object: build_charge_object(
          id: charge_id,
          customer: customer_id,
          invoice: invoice_id,
          amount: amount,
          amount_refunded: amount_refunded,
          captured: true,
          paid: true,
          refunded: amount_refunded >= amount,
          status: "succeeded",
          refunds: {
            object: "list",
            data: [{
              id: refund_id,
              object: "refund",
              amount: amount_refunded,
              created: Time.current.to_i,
              currency: "usd",
              reason: refund_reason,
              status: "succeeded"
            }],
            has_more: false
          }
        )
      }
    )
  end

  # Partial refund
  def charge_partially_refunded_event(
    charge_id:,
    customer_id:,
    original_amount:, refund_amount:, invoice_id: nil,
    refund_reason: "requested_by_customer"
  )
    charge_refunded_event(
      charge_id: charge_id,
      customer_id: customer_id,
      invoice_id: invoice_id,
      amount: original_amount,
      amount_refunded: refund_amount,
      refund_reason: refund_reason
    )
  end

  # ===========================================================================
  # PAYMENT INTENT EVENTS
  # ===========================================================================

  def payment_intent_succeeded_event(
    customer_id:, payment_intent_id: "pi_#{SecureRandom.hex(8)}",
    invoice_id: nil,
    amount: 2900,
    charge_id: "ch_#{SecureRandom.hex(8)}"
  )
    build_stripe_event(
      type: "stripe.payment_intent.succeeded",
      data: {
        object: {
          id: payment_intent_id,
          object: "payment_intent",
          amount: amount,
          amount_received: amount,
          capture_method: "automatic",
          charges: {
            object: "list",
            data: [{
              id: charge_id,
              amount: amount,
              captured: true,
              paid: true,
              status: "succeeded"
            }]
          },
          currency: "usd",
          customer: customer_id,
          invoice: invoice_id,
          latest_charge: charge_id,
          status: "succeeded"
        }
      }
    )
  end

  # ===========================================================================
  # PAYMENT METHOD EVENTS
  # ===========================================================================

  def payment_method_attached_event(
    customer_id:, payment_method_id: "pm_#{SecureRandom.hex(8)}",
    card_brand: "visa",
    card_last4: "4242",
    card_exp_month: 12,
    card_exp_year: 2028
  )
    build_stripe_event(
      type: "stripe.payment_method.attached",
      data: {
        object: {
          id: payment_method_id,
          object: "payment_method",
          billing_details: {
            email: "user@example.com",
            name: "John Doe"
          },
          card: {
            brand: card_brand,
            exp_month: card_exp_month,
            exp_year: card_exp_year,
            last4: card_last4,
            funding: "credit"
          },
          customer: customer_id,
          type: "card"
        }
      }
    )
  end

  def payment_method_detached_event(
    payment_method_id:,
    card_brand: "visa",
    card_last4: "4242"
  )
    build_stripe_event(
      type: "stripe.payment_method.detached",
      data: {
        object: {
          id: payment_method_id,
          object: "payment_method",
          card: {
            brand: card_brand,
            last4: card_last4
          },
          customer: nil, # Detached, so no customer
          type: "card"
        }
      }
    )
  end

  # Card automatically updated by network (e.g., new expiry)
  def payment_method_automatically_updated_event(
    payment_method_id:,
    customer_id:,
    old_exp_month:,
    old_exp_year:,
    new_exp_month:,
    new_exp_year:,
    card_brand: "visa",
    card_last4: "4242"
  )
    build_stripe_event(
      type: "stripe.payment_method.card_automatically_updated",
      data: {
        object: {
          id: payment_method_id,
          object: "payment_method",
          card: {
            brand: card_brand,
            exp_month: new_exp_month,
            exp_year: new_exp_year,
            last4: card_last4
          },
          customer: customer_id,
          type: "card"
        },
        previous_attributes: {
          card: {
            exp_month: old_exp_month,
            exp_year: old_exp_year
          }
        }
      }
    )
  end

  # ===========================================================================
  # CUSTOMER EVENTS
  # ===========================================================================

  def customer_updated_event(
    customer_id:,
    email: "user@example.com",
    name: "John Doe",
    default_source: nil,
    invoice_settings: {}
  )
    build_stripe_event(
      type: "stripe.customer.updated",
      data: {
        object: {
          id: customer_id,
          object: "customer",
          email: email,
          name: name,
          default_source: default_source,
          invoice_settings: invoice_settings
        }
      }
    )
  end

  def customer_deleted_event(customer_id:)
    build_stripe_event(
      type: "stripe.customer.deleted",
      data: {
        object: {
          id: customer_id,
          object: "customer",
          deleted: true
        }
      }
    )
  end

  # ===========================================================================
  # CHECKOUT SESSION EVENTS
  # ===========================================================================

  def checkout_session_completed_event(
    customer_id:, session_id: "cs_#{SecureRandom.hex(8)}",
    subscription_id: nil,
    payment_intent_id: nil,
    mode: "subscription",
    amount_total: 2900,
    metadata: {}
  )
    build_stripe_event(
      type: "stripe.checkout.session.completed",
      data: {
        object: {
          id: session_id,
          object: "checkout.session",
          amount_total: amount_total,
          currency: "usd",
          customer: customer_id,
          mode: mode,
          payment_intent: payment_intent_id,
          payment_status: "paid",
          status: "complete",
          subscription: subscription_id,
          metadata: metadata
        }
      }
    )
  end

  # ===========================================================================
  # SUBSCRIPTION SCHEDULE EVENTS
  # ===========================================================================

  def subscription_schedule_created_event(
    customer_id:, subscription_id:, current_phase_price_id:, next_phase_price_id:, phase_transition_at:, schedule_id: "sub_sched_#{SecureRandom.hex(8)}"
  )
    build_stripe_event(
      type: "stripe.subscription_schedule.created",
      data: {
        object: {
          id: schedule_id,
          object: "subscription_schedule",
          customer: customer_id,
          subscription: subscription_id,
          status: "active",
          current_phase: {
            start_date: Time.current.to_i,
            end_date: phase_transition_at.to_i,
            items: [{price: current_phase_price_id, quantity: 1}]
          },
          phases: [
            {
              start_date: Time.current.to_i,
              end_date: phase_transition_at.to_i,
              items: [{price: current_phase_price_id, quantity: 1}]
            },
            {
              start_date: phase_transition_at.to_i,
              end_date: nil,
              items: [{price: next_phase_price_id, quantity: 1}]
            }
          ]
        }
      }
    )
  end

  # ===========================================================================
  # PRIVATE HELPER METHODS
  # ===========================================================================

  private

  def build_subscription_object(
    id:,
    customer:,
    price_id: "price_growth_monthly",
    status: "active",
    unit_amount: 2900,
    quantity: 1,
    metadata: {},
    price_metadata: {},
    current_period_start: Time.current,
    current_period_end: 1.month.from_now,
    trial_end: nil,
    trial_start: nil,
    cancel_at: nil,
    cancel_at_period_end: false,
    canceled_at: nil,
    cancellation_details: nil,
    ended_at: nil,
    pause_collection: nil,
    discount: nil,
    schedule: nil,
    default_payment_method: nil,
    latest_invoice: nil
  )
    default_payment_method ||= "pm_#{SecureRandom.hex(8)}"
    latest_invoice ||= "in_#{SecureRandom.hex(8)}"

    {
      id: id,
      object: "subscription",
      application: nil,
      application_fee_percent: nil,
      automatic_tax: {enabled: false},
      billing_cycle_anchor: current_period_start.to_i,
      billing_thresholds: nil,
      cancel_at: cancel_at,
      cancel_at_period_end: cancel_at_period_end,
      canceled_at: canceled_at,
      cancellation_details: cancellation_details || {comment: nil, feedback: nil, reason: nil},
      collection_method: "charge_automatically",
      created: current_period_start.to_i,
      currency: "usd",
      current_period_end: current_period_end.to_i,
      current_period_start: current_period_start.to_i,
      customer: customer,
      days_until_due: nil,
      default_payment_method: default_payment_method,
      default_source: nil,
      default_tax_rates: [],
      description: nil,
      discount: discount,
      ended_at: ended_at,
      items: {
        object: "list",
        data: [{
          id: "si_#{SecureRandom.hex(8)}",
          object: "subscription_item",
          billing_thresholds: nil,
          created: current_period_start.to_i,
          metadata: {},
          price: {
            id: price_id,
            object: "price",
            active: true,
            billing_scheme: "per_unit",
            currency: "usd",
            livemode: false,
            lookup_key: price_id.gsub("price_", ""),
            metadata: price_metadata,
            nickname: price_id.gsub("price_", "").titleize,
            product: "prod_#{SecureRandom.hex(8)}",
            recurring: {
              interval: "month",
              interval_count: 1,
              usage_type: "licensed"
            },
            tax_behavior: "unspecified",
            type: "recurring",
            unit_amount: unit_amount,
            unit_amount_decimal: unit_amount.to_s
          },
          quantity: quantity,
          subscription: id,
          tax_rates: []
        }],
        has_more: false
      },
      latest_invoice: latest_invoice,
      livemode: false,
      metadata: metadata,
      next_pending_invoice_item_invoice: nil,
      on_behalf_of: nil,
      pause_collection: pause_collection,
      payment_settings: {
        payment_method_options: nil,
        payment_method_types: nil,
        save_default_payment_method: "on_subscription"
      },
      pending_invoice_item_interval: nil,
      pending_setup_intent: nil,
      pending_update: nil,
      schedule: schedule,
      start_date: current_period_start.to_i,
      status: status,
      test_clock: nil,
      transfer_data: nil,
      trial_end: trial_end,
      trial_settings: {end_behavior: {missing_payment_method: "create_invoice"}},
      trial_start: trial_start
    }
  end

  # Builds invoice object using Stripe API 2025-12-15.clover structure
  # where subscription is accessed via parent.subscription_details.subscription
  def build_invoice_object(
    id:,
    subscription:,
    customer:,
    billing_reason:,
    amount_due:,
    amount_paid:,
    amount_remaining:,
    paid:,
    status:,
    currency: "usd",
    charge: nil,
    payment_intent: nil,
    lines: nil,
    attempt_count: nil,
    next_payment_attempt: nil,
    period_start: nil,
    period_end: nil
  )
    attempt_count ||= paid ? 1 : 0
    period_start ||= 1.month.ago
    period_end ||= Time.current

    {
      id: id,
      object: "invoice",
      account_country: "US",
      account_name: "Your Company",
      amount_due: amount_due,
      amount_paid: amount_paid,
      amount_remaining: amount_remaining,
      attempt_count: attempt_count,
      attempted: attempt_count > 0,
      auto_advance: !paid,
      automatic_tax: {enabled: false, status: nil},
      billing_reason: billing_reason,
      charge: charge,
      collection_method: "charge_automatically",
      created: Time.current.to_i,
      currency: currency,
      customer: customer,
      customer_email: "user@example.com",
      customer_name: "John Doe",
      default_payment_method: nil,
      description: nil,
      discount: nil,
      due_date: nil,
      ending_balance: paid ? 0 : nil,
      footer: nil,
      hosted_invoice_url: id ? "https://invoice.stripe.com/i/acct_xxx/#{id}" : nil,
      invoice_pdf: id ? "https://pay.stripe.com/invoice/acct_xxx/#{id}/pdf" : nil,
      lines: lines || {
        object: "list",
        data: [{
          id: "il_#{SecureRandom.hex(8)}",
          object: "line_item",
          amount: amount_due,
          currency: currency,
          description: "Subscription",
          discount_amounts: [],
          discountable: true,
          discounts: [],
          livemode: false,
          metadata: {},
          period: {
            end: period_end.to_i,
            start: period_start.to_i
          },
          proration: false,
          quantity: 1,
          subscription: subscription,
          type: "subscription"
        }],
        has_more: false
      },
      livemode: false,
      metadata: {},
      next_payment_attempt: next_payment_attempt&.to_i,
      number: id ? "INV-#{SecureRandom.hex(4).upcase}" : nil,
      paid: paid,
      paid_out_of_band: false,
      payment_intent: payment_intent,
      period_end: period_end.to_i,
      period_start: period_start.to_i,
      post_payment_credit_notes_amount: 0,
      pre_payment_credit_notes_amount: 0,
      receipt_number: nil,
      starting_balance: 0,
      statement_descriptor: nil,
      status: status,
      subtotal: amount_due,
      tax: nil,
      total: amount_due,
      webhooks_delivered_at: Time.current.to_i,
      # Stripe API 2025-12-15.clover: subscription accessed via parent.subscription_details.subscription
      parent: {
        "type" => "subscription_details",
        "subscription_details" => {
          "subscription" => subscription
        }
      }
    }
  end

  def build_charge_object(
    id:,
    customer:,
    amount:,
    invoice: nil,
    currency: "usd",
    captured: true,
    paid: true,
    status: "succeeded",
    refunded: false,
    amount_refunded: 0,
    failure_code: nil,
    failure_message: nil,
    payment_intent: nil,
    payment_method: nil,
    outcome: nil,
    refunds: nil
  )
    payment_method ||= "pm_#{SecureRandom.hex(8)}"
    payment_intent ||= "pi_#{SecureRandom.hex(8)}"

    {
      id: id,
      object: "charge",
      amount: amount,
      amount_captured: captured ? amount : 0,
      amount_refunded: amount_refunded,
      application: nil,
      application_fee: nil,
      application_fee_amount: nil,
      balance_transaction: (status == "succeeded") ? "txn_#{SecureRandom.hex(8)}" : nil,
      billing_details: {
        address: {
          city: nil,
          country: "US",
          line1: nil,
          line2: nil,
          postal_code: "12345",
          state: nil
        },
        email: "user@example.com",
        name: "John Doe",
        phone: nil
      },
      calculated_statement_descriptor: "YOUR COMPANY",
      captured: captured,
      created: Time.current.to_i,
      currency: currency,
      customer: customer,
      description: invoice ? "Subscription payment" : "One-time payment",
      destination: nil,
      dispute: nil,
      disputed: false,
      failure_balance_transaction: nil,
      failure_code: failure_code,
      failure_message: failure_message,
      fraud_details: {},
      invoice: invoice,
      livemode: false,
      metadata: {},
      on_behalf_of: nil,
      outcome: outcome || {
        network_status: (status == "succeeded") ? "approved_by_network" : "declined_by_network",
        reason: nil,
        risk_level: "normal",
        risk_score: 32,
        seller_message: (status == "succeeded") ? "Payment complete." : failure_message,
        type: (status == "succeeded") ? "authorized" : "issuer_declined"
      },
      paid: paid,
      payment_intent: payment_intent,
      payment_method: payment_method,
      payment_method_details: {
        card: {
          brand: "visa",
          checks: {
            address_line1_check: nil,
            address_postal_code_check: "pass",
            cvc_check: "pass"
          },
          country: "US",
          exp_month: 12,
          exp_year: 2028,
          fingerprint: "ABC123XYZ",
          funding: "credit",
          last4: "4242",
          network: "visa"
        },
        type: "card"
      },
      receipt_email: "user@example.com",
      receipt_number: nil,
      receipt_url: "https://pay.stripe.com/receipts/...",
      refunded: refunded,
      refunds: refunds || {object: "list", data: [], has_more: false},
      review: nil,
      shipping: nil,
      source: nil,
      source_transfer: nil,
      statement_descriptor: nil,
      statement_descriptor_suffix: nil,
      status: status,
      transfer_data: nil,
      transfer_group: nil
    }
  end
end
