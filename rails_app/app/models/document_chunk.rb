# == Schema Information
#
# Table name: document_chunks
#
#  id            :bigint           not null, primary key
#  answer        :text             not null
#  content       :text
#  context       :jsonb
#  embedding     :vector(1536)
#  position      :integer
#  question      :text             not null
#  question_hash :string           not null
#  section       :string
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#  document_id   :bigint           not null
#
# Indexes
#
#  idx_document_chunks_embedding                           (embedding) USING ivfflat
#  index_document_chunks_on_document_id                    (document_id)
#  index_document_chunks_on_document_id_and_question_hash  (document_id,question_hash) UNIQUE
#  index_document_chunks_on_section                        (section)
#
# Foreign Keys
#
#  fk_rails_...  (document_id => documents.id)
#
class DocumentChunk < ApplicationRecord
  include Embeddable

  belongs_to :document

  validates :question_hash, presence: true, uniqueness: { scope: :document_id }
  validates :question, presence: true
  validates :answer, presence: true

  before_validation :set_question_hash
  before_save :set_content

  scope :by_section, ->(section) { where(section: section) }
  scope :live, -> { joins(:document).where(documents: { status: 'live' }) }
  scope :for_document_type, ->(type) { joins(:document).where(documents: { document_type: type }) }
  scope :with_tag, ->(tag) { joins(:document).where('documents.tags @> ?', [tag].to_json) }

  delegate :slug, :title, :tags, :document_type, to: :document, prefix: true

  private

  def set_question_hash
    return if question.blank?
    self.question_hash = Digest::SHA256.hexdigest(question.to_s.downcase.strip)
  end

  def set_content
    self.content = "#{question}\n\n#{answer}"
  end
end
