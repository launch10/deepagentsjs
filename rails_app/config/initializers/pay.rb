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

Rails.configuration.to_prepare do
  Pay::Subscription.include SubscriptionExtensions
  Pay::Charge.include ChargeExtensions

  # Use Inter font for full UTF-8 support in PDFs
  # https://github.com/rsms/inter
  Receipts.default_font = {
    bold: Rails.root.join("app/assets/fonts/Inter-Bold.ttf"),
    normal: Rails.root.join("app/assets/fonts/Inter-Regular.ttf")
  }
end

Rails.application.config.after_initialize do
  # Pay gem callbacks for syncing subscription changes to Atlas
  if defined?(Pay::Subscription)
    Pay::Subscription.class_eval do
      after_commit :sync_user_to_atlas_after_subscription_change, on: [:create, :update, :destroy]
      
      private
      
      def sync_user_to_atlas_after_subscription_change
        # Find the user through the customer's owner (Account)
        return unless customer&.owner.is_a?(Account)
        
        user = customer.owner.owner # Account owner is the User
        return unless user
        
        # Sync the user to Atlas with updated plan_id
        Atlas.users.update(user.id, plan_id: user.current_plan_id)
      rescue Atlas::BaseService::Error => e
        Rails.logger.error "[Atlas] Failed to sync user after subscription change: #{e.message}"
      end
    end
  end
end