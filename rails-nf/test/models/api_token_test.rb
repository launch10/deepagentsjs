# == Schema Information
#
# Table name: api_tokens
#
#  id           :integer          not null, primary key
#  user_id      :integer          not null
#  token        :string
#  name         :string
#  metadata     :jsonb            default("{}")
#  transient    :boolean          default("false")
#  last_used_at :datetime
#  expires_at   :datetime
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#
# Indexes
#
#  index_api_tokens_on_token    (token) UNIQUE
#  index_api_tokens_on_user_id  (user_id)
#

require "test_helper"

class ApiTokenTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
