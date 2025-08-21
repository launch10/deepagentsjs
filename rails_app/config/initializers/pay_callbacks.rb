# frozen_string_literal: true

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