# == Schema Information
#
# Table name: deploys
#
#  id                 :bigint           not null, primary key
#  environment        :string           default("production"), not null
#  is_live            :boolean          default(FALSE)
#  is_preview         :boolean          default(FALSE), not null
#  revertible         :boolean          default(FALSE)
#  shasum             :string
#  stacktrace         :text
#  status             :string           not null
#  trigger            :string           default("manual")
#  version_path       :string
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  snapshot_id        :string
#  website_history_id :bigint
#  website_id         :bigint
#
# Indexes
#
#  index_deploys_on_created_at                                 (created_at)
#  index_deploys_on_environment                                (environment)
#  index_deploys_on_is_live                                    (is_live)
#  index_deploys_on_is_preview                                 (is_preview)
#  index_deploys_on_revertible                                 (revertible)
#  index_deploys_on_shasum                                     (shasum)
#  index_deploys_on_snapshot_id                                (snapshot_id)
#  index_deploys_on_status                                     (status)
#  index_deploys_on_trigger                                    (trigger)
#  index_deploys_on_website_history_id                         (website_history_id)
#  index_deploys_on_website_id                                 (website_id)
#  index_deploys_on_website_id_and_environment_and_is_preview  (website_id,environment,is_preview)
#  index_deploys_on_website_id_and_is_live                     (website_id,is_live)
#

class Deploy < ApplicationRecord
  include DeployConcerns::Buildable
  include DeployConcerns::Deployable

  STATUS = %w[pending building uploading completed failed skipped]
  ENVIRONMENTS = %w[development staging production]

  belongs_to :website

  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }
  scope :pending, -> { where(status: "pending") }
  scope :live, -> { where(is_live: true) }
  scope :preview, -> { where(is_preview: true) }
  scope :revertible, -> { where(revertible: true) }

  validates :status, inclusion: {in: STATUS}
  validates :environment, inclusion: {in: ENVIRONMENTS}
  validates :status, presence: true
  validates :website, presence: true
end
