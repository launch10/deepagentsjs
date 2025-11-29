# == Schema Information
#
# Table name: documents
#
#  id             :bigint           not null, primary key
#  content        :text
#  document_type  :string
#  last_synced_at :datetime
#  metadata       :jsonb
#  slug           :string           not null
#  source_type    :string
#  source_url     :string
#  status         :string           default("draft"), not null
#  tags           :jsonb
#  title          :string
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  source_id      :string
#
# Indexes
#
#  index_documents_on_document_type  (document_type)
#  index_documents_on_slug           (slug) UNIQUE
#  index_documents_on_source_type    (source_type)
#  index_documents_on_status         (status)
#  index_documents_on_tags           (tags) USING gin
#
class Document < ApplicationRecord
  include DocumentConcerns::ChunkSync
  include DocumentConcerns::FrontmatterParsing

  has_many :chunks, class_name: 'DocumentChunk', dependent: :destroy

  validates :slug, presence: true, uniqueness: true
  validates :status, presence: true, inclusion: { in: %w[draft live] }

  scope :live, -> { where(status: 'live') }
  scope :draft, -> { where(status: 'draft') }
  scope :by_type, ->(type) { where(document_type: type) }
  scope :with_tag, ->(tag) { where('tags @> ?', [tag].to_json) }
  scope :with_any_tag, ->(tags) { where('tags ?| array[:tags]', tags: tags) }
  scope :from_source, ->(source) { where(source_type: source) }

  def live?
    status == 'live'
  end

  def draft?
    status == 'draft'
  end

  def add_tag(tag)
    self.tags = (tags || []) | [tag]
  end

  def remove_tag(tag)
    self.tags = (tags || []) - [tag]
  end

  def has_tag?(tag)
    (tags || []).include?(tag)
  end
end
