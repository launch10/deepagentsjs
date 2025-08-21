# == Schema Information
#
# Table name: deploys
#
#  id                 :integer          not null, primary key
#  website_id         :integer
#  website_history_id :integer
#  status             :string           not null
#  trigger            :string           default("manual")
#  stacktrace         :text
#  snapshot_id        :string
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#
# Indexes
#
#  index_deploys_on_created_at          (created_at)
#  index_deploys_on_snapshot_id         (snapshot_id)
#  index_deploys_on_status              (status)
#  index_deploys_on_trigger             (trigger)
#  index_deploys_on_website_history_id  (website_history_id)
#  index_deploys_on_website_id          (website_id)
#

class Deploy < ApplicationRecord
  belongs_to :website
end
