class PosthogSubscriber
  NAMESPACE = "app_event"

  class << self
    def subscribe!
      ActiveSupport::Notifications.subscribe(/\A#{NAMESPACE}\./) do |name, _start, _finish, _id, payload|
        event_name = name.delete_prefix("#{NAMESPACE}.")

        user = payload.delete(:user)
        account = payload.delete(:account)
        project = payload.delete(:project)
        campaign = payload.delete(:campaign)
        website = payload.delete(:website)
        properties = payload

        write_posthog(user, event_name, properties)
        write_app_event(
          user: user,
          account: account,
          project: project,
          campaign: campaign,
          website: website,
          event_name: event_name,
          properties: properties
        )
      end
    end

    private

    def write_posthog(user, event_name, properties)
      return unless user

      PosthogTracker.capture(user, event_name, properties)
    end

    def write_app_event(user:, account:, project:, campaign:, website:, event_name:, properties:)
      AppEvent.create!(
        user: user,
        account: account || resolve_account(user, project),
        project: project,
        campaign: campaign,
        website: website,
        event_name: event_name,
        properties: properties
      )
    rescue => e
      Rails.logger.error("PosthogSubscriber.write_app_event failed: #{e.message}")
    end

    def resolve_account(user, project)
      project&.account || user&.accounts&.first
    end
  end
end
