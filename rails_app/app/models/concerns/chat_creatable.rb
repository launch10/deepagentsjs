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
module ChatCreatable
  extend ActiveSupport::Concern

  included do
    has_one :chat, as: :contextable, dependent: :destroy
    after_create :create_chat!
  end

  private

  def create_chat!
    Chat.create!(
      thread_id: SecureRandom.uuid,
      chat_type: self.class.chat_type,
      project: chat_project,
      account: chat_account,
      contextable: self,
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
