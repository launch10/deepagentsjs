# == Schema Information
#
# Table name: website_file_histories
#
#  id                    :integer          not null, primary key
#  website_file_id       :integer          not null
#  website_id            :integer          not null
#  file_specification_id :integer
#  path                  :string           not null
#  content               :string           not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  history_started_at    :datetime         not null
#  history_ended_at      :datetime
#  history_user_id       :integer
#  snapshot_id           :string
#  shasum                :string
#  content_tsv           :tsvector
#
# Indexes
#
#  idx_website_file_histories_content_tsv                 (content_tsv)
#  index_website_file_histories_on_created_at             (created_at)
#  index_website_file_histories_on_file_specification_id  (file_specification_id)
#  index_website_file_histories_on_history_ended_at       (history_ended_at)
#  index_website_file_histories_on_history_started_at     (history_started_at)
#  index_website_file_histories_on_history_user_id        (history_user_id)
#  index_website_file_histories_on_shasum                 (shasum)
#  index_website_file_histories_on_snapshot_id            (snapshot_id)
#  index_website_file_histories_on_updated_at             (updated_at)
#  index_website_file_histories_on_website_file_id        (website_file_id)
#  index_website_file_histories_on_website_id             (website_id)
#

class WebsiteFileHistory < ApplicationRecord
  include Historiographer::History
end
