# == Schema Information
#
# Table name: uploads
#
#  id         :bigint           not null, primary key
#  file       :string           not null
#  media_type :string           not null
#  uuid       :uuid             not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint           not null
#
# Indexes
#
#  index_uploads_on_account_id  (account_id)
#  index_uploads_on_created_at  (created_at)
#  index_uploads_on_media_type  (media_type)
#  index_uploads_on_uuid        (uuid) UNIQUE
#
require 'rails_helper'

RSpec.describe Upload, type: :model do
  pending "add some examples to (or delete) #{__FILE__}"
end
