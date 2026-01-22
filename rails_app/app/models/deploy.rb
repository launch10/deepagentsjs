# == Schema Information
#
# Table name: deploys
#
#  id                 :bigint           not null, primary key
#  current_step       :string
#  is_live            :boolean          default(FALSE)
#  stacktrace         :text
#  status             :string           default("pending"), not null
#  user_active_at     :datetime
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  campaign_deploy_id :bigint
#  project_id         :bigint           not null
#  website_deploy_id  :bigint
#
# Indexes
#
#  index_deploys_on_campaign_deploy_id      (campaign_deploy_id)
#  index_deploys_on_is_live                 (is_live)
#  index_deploys_on_project_id              (project_id)
#  index_deploys_on_project_id_and_is_live  (project_id,is_live)
#  index_deploys_on_project_id_and_status   (project_id,status)
#  index_deploys_on_status                  (status)
#  index_deploys_on_website_deploy_id       (website_deploy_id)
#
# Foreign Keys
#
#  fk_rails_...  (campaign_deploy_id => campaign_deploys.id)
#  fk_rails_...  (project_id => projects.id)
#  fk_rails_...  (website_deploy_id => website_deploys.id)
#
class Deploy < ApplicationRecord
  include ChatCreatable

  STATUS = %w[pending running completed failed].freeze

  belongs_to :project
  has_one :website, through: :project
  belongs_to :website_deploy, class_name: "WebsiteDeploy", optional: true
  belongs_to :campaign_deploy, optional: true
  has_many :job_runs, dependent: :nullify

  validates :status, presence: true, inclusion: { in: STATUS }

  scope :live, -> { where(is_live: true) }
  scope :in_progress, -> { where(status: %w[pending running]) }
  scope :user_recently_active, -> { where(user_active_at: 5.minutes.ago..) }

  def self.chat_type
    "deploy"
  end

  def touch_user_active!
    update_column(:user_active_at, Time.current)
  end
end
