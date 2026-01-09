# == Schema Information
#
# Table name: leads
#
#  id         :bigint           not null, primary key
#  email      :string(255)      not null
#  name       :string(255)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  project_id :bigint           not null
#
# Indexes
#
#  index_leads_on_email                 (email)
#  index_leads_on_project_id            (project_id)
#  index_leads_on_project_id_and_email  (project_id,email) UNIQUE
#

class Lead < ApplicationRecord
  belongs_to :project

  validates :email, presence: true,
    length: { maximum: 255 },
    format: { with: URI::MailTo::EMAIL_REGEXP },
    uniqueness: { scope: :project_id, case_sensitive: false }
  validates :name, length: { maximum: 255 }, allow_blank: true

  before_validation :normalize_email

  private

  def normalize_email
    self.email = email&.downcase&.strip
  end

  class << self
    def normalize_email(email)
      email&.downcase&.strip
    end
  end
end
