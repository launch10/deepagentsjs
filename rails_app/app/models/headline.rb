# == Schema Information
#
# Table name: headlines
#
#  id         :bigint           not null, primary key
#  position   :integer          not null
#  text       :string           not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  ad_id      :bigint           not null
#
# Indexes
#
#  index_headlines_on_ad_id               (ad_id)
#  index_headlines_on_ad_id_and_position  (ad_id,position)
#  index_headlines_on_created_at          (created_at)
#  index_headlines_on_position            (position)
#
class Headline < ApplicationRecord
end
