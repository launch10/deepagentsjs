# Concern for tracking model changes as AgentContextEvents
#
# Usage:
#   class WebsiteUpload < ApplicationRecord
#     include TracksAgentContext
#
#     tracks_agent_context_on_create 'images.created',
#       payload: ->(record) { { upload_id: record.upload.id } },
#       if: ->(record) { record.upload.image? }
#   end
#
module TracksAgentContext
  extend ActiveSupport::Concern

  class_methods do
    # Track event on record creation
    def tracks_agent_context_on_create(event_type, payload: nil, **options)
      after_create(**filter_callback_options(options)) do
        create_agent_context_event(event_type, payload)
      end
    end

    # Track event on record destruction
    def tracks_agent_context_on_destroy(event_type, payload: nil, **options)
      after_destroy(**filter_callback_options(options)) do
        create_agent_context_event(event_type, payload)
      end
    end

    # Track event on record update
    def tracks_agent_context_on_update(event_type, payload: nil, **options)
      after_update(**filter_callback_options(options)) do
        create_agent_context_event(event_type, payload)
      end
    end

    private

    def filter_callback_options(options)
      options.slice(:if, :unless)
    end
  end

  private

  def create_agent_context_event(event_type, payload_proc)
    proj = find_project_for_context
    acct = Current.account || proj&.account

    return unless acct # Can't track without an account

    # Build payload
    payload_data = case payload_proc
    when Proc
      payload_proc.call(self)
    when Hash
      payload_proc
    else
      {}
    end

    AgentContextEvent.create!(
      account: acct,
      user: Current.user,
      project: proj,
      event_type: event_type,
      eventable: self,
      payload: payload_data
    )
  rescue => e
    Rails.logger.error("[TracksAgentContext] Failed to create context event: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    # Don't raise - context tracking shouldn't break the main operation
  end

  def find_project_for_context
    return project if respond_to?(:project) && project.present?
    return website.project if respond_to?(:website) && website&.project.present?
    # For models with multiple websites, use first
    if respond_to?(:websites)
      websites.first&.project
    end
  end
end
