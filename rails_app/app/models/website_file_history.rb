# == Schema Information
#
# Table name: website_file_histories
#
#  id                 :bigint           not null, primary key
#  content            :string           not null
#  content_tsv        :tsvector
#  deleted_at         :datetime
#  history_ended_at   :datetime
#  history_started_at :datetime         not null
#  path               :string           not null
#  shasum             :string
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  history_user_id    :integer
#  snapshot_id        :string
#  website_file_id    :integer          not null
#  website_id         :integer          not null
#
# Indexes
#
#  idx_website_file_histories_content_tsv              (content_tsv) USING gin
#  index_website_file_histories_on_created_at          (created_at)
#  index_website_file_histories_on_deleted_at          (deleted_at)
#  index_website_file_histories_on_history_ended_at    (history_ended_at)
#  index_website_file_histories_on_history_started_at  (history_started_at)
#  index_website_file_histories_on_history_user_id     (history_user_id)
#  index_website_file_histories_on_shasum              (shasum)
#  index_website_file_histories_on_snapshot_id         (snapshot_id)
#  index_website_file_histories_on_updated_at          (updated_at)
#  index_website_file_histories_on_website_file_id     (website_file_id)
#  index_website_file_histories_on_website_id          (website_id)
#

class WebsiteFileHistory < ApplicationRecord
  include Historiographer::History
  acts_as_paranoid
end
