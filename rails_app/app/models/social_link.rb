# == Schema Information
#
# Table name: social_links
#
#  id         :bigint           not null, primary key
#  deleted_at :datetime
#  handle     :string
#  platform   :string           not null
#  url        :string           not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  project_id :bigint           not null
#
# Indexes
#
#  index_social_links_on_deleted_at               (deleted_at)
#  index_social_links_on_project_id               (project_id)
#  index_social_links_on_project_id_and_platform  (project_id,platform) UNIQUE WHERE (deleted_at IS NULL)
#
# Foreign Keys
#
#  fk_rails_...  (project_id => projects.id)
#

class SocialLink < ApplicationRecord
  acts_as_paranoid

  include SocialLinkConcerns::Normalizable

  PLATFORMS = %w[twitter instagram facebook linkedin youtube tiktok website other].freeze

  belongs_to :project

  validates :platform, presence: true, inclusion: { in: PLATFORMS }
  validates :platform, uniqueness: { scope: :project_id }
  validates :url, presence: true, format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]) }

  def self.platform_options
    PLATFORMS.map { |p| [p.titleize, p] }
  end
end
