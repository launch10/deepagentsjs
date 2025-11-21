# == Schema Information
#
# Table name: projects
#
#  id         :bigint           not null, primary key
#  name       :string           not null
#  uuid       :uuid             not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint           not null
#
# Indexes
#
#  index_projects_on_account_id                 (account_id)
#  index_projects_on_account_id_and_created_at  (account_id,created_at)
#  index_projects_on_account_id_and_name        (account_id,name) UNIQUE
#  index_projects_on_account_id_and_updated_at  (account_id,updated_at)
#  index_projects_on_created_at                 (created_at)
#  index_projects_on_name                       (name)
#  index_projects_on_updated_at                 (updated_at)
#  index_projects_on_uuid                       (uuid) UNIQUE
#

class Project < ApplicationRecord
  acts_as_tenant :account

  belongs_to :account
  validates :name, presence: true
  validates :account_id, presence: true
  before_validation :set_uuid, on: :create

  has_one :website
  has_many :workflows, class_name: 'ProjectWorkflow', dependent: :destroy

  include ProjectConcerns::Serialization

  private

  def set_uuid
    return if uuid.present?

    self.uuid = UUID7.generate
  end
end
