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
#  project_id       :bigint           not null
#  thread_id        :string           not null
#
# Indexes
#
#  index_chats_on_account_id                (account_id)
#  index_chats_on_chat_type                 (chat_type)
#  index_chats_on_chat_type_and_project_id  (chat_type,project_id) UNIQUE
#  index_chats_on_project_id                (project_id)
#  index_chats_on_thread_id                 (thread_id)
#

class Chat < ApplicationRecord
  acts_as_tenant :account

  belongs_to :project
  belongs_to :contextable, polymorphic: true, optional: true

  CHAT_TYPES = ProjectWorkflow.steps_for(:launch) # brainstorm, website, ad_campaign, etc

  validates :chat_type, presence: true, inclusion: {in: CHAT_TYPES}
  validates :thread_id, presence: true
  validates :project_id, presence: true
  validates :account_id, presence: true
end
