# == Schema Information
#
# Table name: connected_accounts
#
#  id                  :integer          not null, primary key
#  owner_id            :integer
#  provider            :string
#  uid                 :string
#  refresh_token       :string
#  expires_at          :datetime
#  auth                :jsonb
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  access_token        :string
#  access_token_secret :string
#  owner_type          :string
#
# Indexes
#
#  index_connected_accounts_on_owner_id_and_owner_type  (owner_id,owner_type)
#

class ConnectedAccount < ApplicationRecord
  include Token
  include Oauth

  belongs_to :owner, polymorphic: true
end
