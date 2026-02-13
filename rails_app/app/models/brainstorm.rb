# == Schema Information
#
# Table name: brainstorms
#
#  id            :bigint           not null, primary key
#  audience      :string
#  completed_at  :datetime
#  deleted_at    :datetime
#  idea          :string
#  look_and_feel :string
#  social_proof  :string
#  solution      :string
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#  website_id    :bigint
#
# Indexes
#
#  index_brainstorms_on_completed_at  (completed_at)
#  index_brainstorms_on_created_at    (created_at)
#  index_brainstorms_on_deleted_at    (deleted_at)
#  index_brainstorms_on_website_id    (website_id) UNIQUE
#

class Brainstorm < ApplicationRecord
  acts_as_paranoid

  belongs_to :website
  has_one :project, through: :website

  include ChatCreatable
  include BrainstormConcerns::Creation
  include BrainstormConcerns::Updating
  include BrainstormConcerns::Serialization
  include TracksAgentContext

  before_save :set_completed_at

  after_create_commit :track_brainstorm_started
  after_update_commit :track_brainstorm_completed

  tracks_agent_context_on_update "brainstorm.finished",
    payload: ->(b) {
      {
        idea: b.idea,
        audience: b.audience,
        solution: b.solution,
        social_proof: b.social_proof,
        theme_name: b.website&.theme&.name
      }
    },
    if: ->(b) { b.just_completed? }

  def self.chat_type
    "brainstorm"
  end

  def name
    chat&.name || project&.name
  end

  def project_id
    project.id
  end

  # Returns true if all four core brainstorm fields are filled in
  def complete?
    idea.present? && audience.present? && solution.present? && social_proof.present?
  end

  # Returns true only during the save that first completed the brainstorm
  def just_completed?
    saved_change_to_completed_at? && completed_at.present?
  end

  private

  def set_completed_at
    self.completed_at = Time.current if complete? && completed_at.blank?
  end

  def track_brainstorm_started
    account = project&.account
    return unless account&.owner

    TrackEvent.call("brainstorm_started",
      user: account.owner,
      account: account,
      project: project,
      website: website,
      project_uuid: project&.uuid,
      is_first_brainstorm: Brainstorm.joins(website: :project).where(projects: {account_id: account.id}).count <= 1
    )
  end

  def track_brainstorm_completed
    return unless just_completed?

    account = project&.account
    TrackEvent.call("brainstorm_completed",
      user: account&.owner,
      account: account,
      project: project,
      website: website,
      project_uuid: project&.uuid,
      duration_minutes: created_at ? ((Time.current - created_at) / 1.minute).round : nil
    )
  end
end
