# == Schema Information
#
# Table name: website_histories
#
#  id                 :bigint           not null, primary key
#  history_ended_at   :datetime
#  history_started_at :datetime         not null
#  name               :string
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :integer
#  history_user_id    :integer
#  project_id         :integer
#  snapshot_id        :string
#  template_id        :integer
#  theme_id           :integer
#  thread_id          :string
#  website_id         :integer          not null
#
# Indexes
#
#  index_website_histories_on_account_id          (account_id)
#  index_website_histories_on_created_at          (created_at)
#  index_website_histories_on_history_ended_at    (history_ended_at)
#  index_website_histories_on_history_started_at  (history_started_at)
#  index_website_histories_on_history_user_id     (history_user_id)
#  index_website_histories_on_name                (name)
#  index_website_histories_on_project_id          (project_id)
#  index_website_histories_on_snapshot_id         (snapshot_id)
#  index_website_histories_on_template_id         (template_id)
#  index_website_histories_on_theme_id            (theme_id)
#  index_website_histories_on_thread_id           (thread_id)
#  index_website_histories_on_website_id          (website_id)
#

class WebsiteHistory < ApplicationRecord
  include Historiographer::History

  has_many :deploys
end
