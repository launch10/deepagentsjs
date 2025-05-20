# == Schema Information
#
# Table name: account_users
#
#  id         :integer          not null, primary key
#  account_id :integer
#  user_id    :integer
#  roles      :jsonb            default("{}"), not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_account_users_on_account_id_and_user_id  (account_id,user_id) UNIQUE
#

require "test_helper"

class AccountUserTest < ActiveSupport::TestCase
  test "converts roles to booleans" do
    member = AccountUser.new admin: "1"
    assert_equal true, member.admin
  end

  test "can be assigned a role" do
    member = AccountUser.new admin: true
    assert_equal true, member.admin
    assert_equal true, member.admin?
  end

  test "role can be false" do
    member = AccountUser.new admin: false
    assert_equal false, member.admin
    assert_equal false, member.admin?
  end

  test "keeps track of active roles" do
    member = AccountUser.new admin: true
    assert_equal [:admin], member.active_roles
  end

  test "has no active roles" do
    member = AccountUser.new admin: false
    assert_empty member.active_roles
  end

  test "owner cannot remove the admin role" do
    member = account_users(:company_admin)
    assert member.account_owner?
    member.update(admin: false)
    assert_not member.valid?
  end
end
