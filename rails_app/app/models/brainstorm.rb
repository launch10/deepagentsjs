# == Schema Information
#
# Table name: brainstorms
#
#  id            :integer          not null, primary key
#  idea          :string
#  audience      :string
#  solution      :string
#  social_proof  :string
#  look_and_feel :string
#  website_id    :integer
#  completed_at  :datetime
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#
# Indexes
#
#  index_brainstorms_on_completed_at  (completed_at)
#  index_brainstorms_on_created_at    (created_at)
#  index_brainstorms_on_website_id    (website_id) UNIQUE
#

class Brainstorm < ApplicationRecord
  belongs_to :website
  has_one :chat, as: :contextable

  include BrainstormConcerns::Creation
  include BrainstormConcerns::Updating
  include BrainstormConcerns::Serialization
end
