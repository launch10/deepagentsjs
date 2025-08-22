# == Schema Information
#
# Table name: deploys
#
#  id                 :integer          not null, primary key
#  website_id         :integer
#  website_history_id :integer
#  status             :string           not null
#  trigger            :string           default("manual")
#  stacktrace         :text
#  snapshot_id        :string
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  is_live            :boolean          default("false")
#  revertible         :boolean          default("false")
#  version_path       :string
#  environment        :string           default("production"), not null
#  is_preview         :boolean          default("false"), not null
#
# Indexes
#
#  index_deploys_on_created_at                                 (created_at)
#  index_deploys_on_environment                                (environment)
#  index_deploys_on_is_live                                    (is_live)
#  index_deploys_on_is_preview                                 (is_preview)
#  index_deploys_on_revertible                                 (revertible)
#  index_deploys_on_snapshot_id                                (snapshot_id)
#  index_deploys_on_status                                     (status)
#  index_deploys_on_trigger                                    (trigger)
#  index_deploys_on_website_history_id                         (website_history_id)
#  index_deploys_on_website_id                                 (website_id)
#  index_deploys_on_website_id_and_environment_and_is_preview  (website_id,environment,is_preview)
#  index_deploys_on_website_id_and_is_live                     (website_id,is_live)
#

class Deploy < ApplicationRecord
  include Buildable
  include Deployable

  STATUS = %w[pending building uploading completed failed]
  ENVIRONMENTS = %w[development staging production]

  belongs_to :website

  scope :completed, -> { where(status: 'completed') }
  scope :failed, -> { where(status: 'failed') }
  scope :pending, -> { where(status: 'pending') }
  scope :live, -> { where(is_live: true) }
  scope :preview, -> { where(is_preview: true) }
  scope :revertible, -> { where(revertible: true) }
  
  validates :status, inclusion: { in: STATUS }
  validates :environment, inclusion: { in: ENVIRONMENTS }
  validates :status, presence: true
  validates :website, presence: true
end
