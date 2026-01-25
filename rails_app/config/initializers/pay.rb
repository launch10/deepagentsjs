Pay.setup do |config|
  config.application_name = Jumpstart.config.application_name
  config.business_name = Jumpstart.config.business_name
  config.business_address = Jumpstart.config.business_address
  config.support_email = Jumpstart.config.support_email

  config.routes_path = "/"

  config.mail_to = -> {
    pay_customer = params[:pay_customer]
    account = pay_customer.owner

    recipients = [ActionMailer::Base.email_address_with_name(account.owner.email, pay_customer.customer_name)]
    recipients << account.billing_email if account.billing_email?
    recipients
  }
end

module SubscriptionExtensions
  extend ActiveSupport::Concern

  included do
    has_prefix_id :sub
    delegate :currency, to: :plan
  end

  def plan
    @plan ||= Plan.where("#{customer.processor}_id": processor_plan).first
  end

  def amount
    (quantity == 0) ? plan.amount : plan.amount * quantity
  end
end

module ChargeExtensions
  extend ActiveSupport::Concern

  included do
    has_prefix_id :ch
    after_create :complete_referral, if: -> { defined?(Refer) }
  end

  # Mark the account owner's referral complete on the first successful payment
  def complete_referral
    customer.owner.owner.referral&.complete!
  end
end

module AtlasExtensions
  extend ActiveSupport::Concern

  included do
    after_commit :sync_user_to_atlas_after_subscription_change, on: [:create, :update, :destroy]
  end

  def sync_user_to_atlas_after_subscription_change
    # Find the user through the customer's owner (Account)
    return unless customer&.owner.is_a?(Account)

    customer.owner.send(:enqueue_sync_to_atlas_on_update)
  rescue Atlas::BaseService::Error => e
    Rails.logger.error "[Atlas] Failed to sync user after subscription change: #{e.message}"
  end
end

module OneSubscriptionPerUser
  extend ActiveSupport::Concern

  included do
    validate :one_active_subscription_per_customer, on: :create
  end

  private

  def one_active_subscription_per_customer
    return unless customer.present?

    existing_active = customer.owner.subscriptions.active.where.not(id: id)
    if existing_active.exists?
      errors.add(:base, "Customer can only have one active subscription")
    end
  end
end

module CloudflareExtensions
  extend ActiveSupport::Concern

  included do
    after_commit :unblock_firewall_after_subscription_change, on: [:create, :update]
  end

  private

  def unblock_firewall_after_subscription_change
    return unless customer&.owner.is_a?(Account)

    customer.owner.reload
    if customer.owner.firewall&.blocked?
      Cloudflare::Firewall.unblock_account(customer.owner)
    end
  rescue Atlas::BaseService::Error => e
    Rails.logger.error "[Atlas] Failed to unblock firewall after subscription change: #{e.message}"
  end
end

Rails.configuration.to_prepare do
  Pay::Subscription.include SubscriptionExtensions
  Pay::Subscription.include AtlasExtensions
  Pay::Subscription.include CloudflareExtensions
  Pay::Subscription.include OneSubscriptionPerUser
  Pay::Subscription.include PaySubscriptionCredits
  Pay::Charge.include ChargeExtensions

  # Use Inter font for full UTF-8 support in PDFs
  # https://github.com/rsms/inter
  Receipts.default_font = {
    bold: Rails.root.join("app/assets/fonts/Inter-Bold.ttf"),
    normal: Rails.root.join("app/assets/fonts/Inter-Regular.ttf")
  }
end
