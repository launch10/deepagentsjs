# == Schema Information
#
# Table name: social_links
#
#  id         :bigint           not null, primary key
#  handle     :string
#  platform   :string           not null
#  url        :string
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  project_id :bigint           not null
#
# Indexes
#
#  index_social_links_on_project_id               (project_id)
#  index_social_links_on_project_id_and_platform  (project_id,platform) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (project_id => projects.id)
#

class SocialLink < ApplicationRecord
  PLATFORMS = %w[twitter instagram facebook linkedin youtube tiktok website other].freeze

  belongs_to :project

  validates :platform, presence: true, inclusion: { in: PLATFORMS }
  validates :platform, uniqueness: { scope: :project_id }
  validates :url, format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]), allow_blank: true }

  def self.platform_options
    PLATFORMS.map { |p| [p.titleize, p] }
  end
end
