# frozen_string_literal: true

# Shared concern for models that have an associated Chat record.
# Automatically creates a Chat when the model is created.
#
# Usage:
#   class Website < ApplicationRecord
#     include ChatCreatable
#
#     def self.chat_type
#       "website"
#     end
#   end
#
# Requirements:
#   - Model must have a `project` association (direct or through)
#   - Model must have an `account` method (direct association or delegated through project)
#
# Optional:
#   - Set `initial_thread_id` before creation to use a specific thread_id
#     instead of generating a new UUID
#
module ChatCreatable
  extend ActiveSupport::Concern

  included do
    has_one :chat, as: :contextable, dependent: :destroy
    after_create :create_chat!

    # Virtual attribute for passing in a specific thread_id during creation
    attr_accessor :initial_thread_id
  end

  # Delegate thread_id to chat - single source of truth
  def thread_id
    chat&.thread_id
  end

  private

  # Specifically this could bite us in the butt if we want to have multiple campaigns or websites per project,
  # but for now it's a simple implementation.
  def create_chat!
    return if Chat.find_by(chat_type: self.class.chat_type, project: chat_project).present?

    Chat.create!(
      chat_type: self.class.chat_type,
      project: chat_project,
      account: chat_account,
      contextable: self,
      thread_id: initial_thread_id.presence || SecureRandom.uuid,
      name: chat_name
    )
  end

  # Override in model if needed
  def chat_project
    project
  end

  # Override in model if needed
  def chat_account
    respond_to?(:account) ? account : project.account
  end

  def chat_name
    chat_project&.name || "Chat"
  end

  class_methods do
    def chat_type
      raise NotImplementedError, "#{name} must define self.chat_type"
    end
  end
end
