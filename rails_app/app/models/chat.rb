# == Schema Information
#
# Table name: chats
#
#  id               :bigint           not null, primary key
#  chat_type        :string           not null
#  contextable_type :string
#  name             :string
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  account_id       :bigint           not null
#  contextable_id   :bigint
#  project_id       :bigint
#  thread_id        :string           not null
#
# Indexes
#
#  index_chats_on_account_id                (account_id)
#  index_chats_on_chat_type                 (chat_type)
#  index_chats_on_chat_type_and_account_id  (chat_type,account_id) UNIQUE WHERE (project_id IS NULL)
#  index_chats_on_chat_type_and_project_id  (chat_type,project_id) UNIQUE WHERE (project_id IS NOT NULL)
#  index_chats_on_project_id                (project_id)
#  index_chats_on_thread_id                 (thread_id)
#

class Chat < ApplicationRecord
  acts_as_tenant :account

  belongs_to :project, optional: true
  belongs_to :contextable, polymorphic: true, optional: true

  # Project-level chat types (require project_id)
  PROJECT_CHAT_TYPES = ProjectWorkflow.steps_for(:launch) # brainstorm, website, ad_campaign, etc

  # Account-level chat types (no project_id)
  ACCOUNT_CHAT_TYPES = %w[insights].freeze

  CHAT_TYPES = PROJECT_CHAT_TYPES + ACCOUNT_CHAT_TYPES

  validates :chat_type, presence: true, inclusion: {in: CHAT_TYPES}
  validates :thread_id, presence: true
  validates :account_id, presence: true
  validates :project_id, presence: true, unless: :account_level_chat?

  def account_level_chat?
    ACCOUNT_CHAT_TYPES.include?(chat_type)
  end
end
