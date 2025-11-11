# == Schema Information
#
# Table name: chats
#
#  id               :integer          not null, primary key
#  name             :string
#  type             :string           not null
#  thread_id        :string           not null
#  project_id       :integer          not null
#  account_id       :integer          not null
#  contextable_type :string
#  contextable_id   :integer
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#
# Indexes
#
#  index_chats_on_account_id           (account_id)
#  index_chats_on_project_id           (project_id)
#  index_chats_on_thread_id            (thread_id)
#  index_chats_on_type                 (type)
#  index_chats_on_type_and_project_id  (type,project_id) UNIQUE
#

class Chat < ApplicationRecord
  acts_as_tenant :account

  belongs_to :project
  belongs_to :contextable, polymorphic: true

  TYPES = %w(brainstorm website ads)

  validates :type, presence: true, inclusion: { in: TYPES }
  validates :thread_id, presence: true
  validates :project_id, presence: true
  validates :account_id, presence: true
end
