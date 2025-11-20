# == Schema Information
#
# Table name: connected_accounts
#
#  id                  :bigint           not null, primary key
#  access_token        :string
#  access_token_secret :string
#  auth                :jsonb
#  expires_at          :datetime
#  owner_type          :string
#  provider            :string
#  refresh_token       :string
#  uid                 :string
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  owner_id            :bigint
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
