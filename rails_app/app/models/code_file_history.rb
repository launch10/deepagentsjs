# == Schema Information
#
# Table name: code_file_histories
#
#  content     :string
#  content_tsv :tsvector
#  path        :string
#  shasum      :string
#  source_type :text
#  created_at  :datetime
#  updated_at  :datetime
#  snapshot_id :string
#  source_id   :bigint
#  website_id  :integer
#
class CodeFileHistory < ApplicationRecord
  self.table_name = "code_file_histories"
  self.primary_key = nil

  def readonly?
    true
  end

  belongs_to :website

  scope :for_snapshot, ->(snapshot_id) { where(snapshot_id: snapshot_id) }
  scope :for_website, ->(website_id) { where(website_id: website_id) }

  def website_file?
    source_type == "WebsiteFile"
  end

  def template_file?
    source_type == "TemplateFile"
  end
end
