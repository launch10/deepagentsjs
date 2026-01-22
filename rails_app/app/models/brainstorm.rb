# == Schema Information
#
# Table name: brainstorms
#
#  id            :bigint           not null, primary key
#  audience      :string
#  completed_at  :datetime
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
#  index_brainstorms_on_website_id    (website_id) UNIQUE
#

class Brainstorm < ApplicationRecord
  belongs_to :website
  has_one :project, through: :website

  include ChatCreatable
  include BrainstormConcerns::Creation
  include BrainstormConcerns::Updating
  include BrainstormConcerns::Serialization

  def self.chat_type
    "brainstorm"
  end

  def name
    chat&.name || project&.name
  end

  def project_id
    project.id
  end
end
