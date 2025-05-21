# == Schema Information
#
# Table name: users
#
#  id                     :integer          not null, primary key
#  email                  :string           default(""), not null
#  encrypted_password     :string           default(""), not null
#  reset_password_token   :string
#  reset_password_sent_at :datetime
#  remember_created_at    :datetime
#  confirmation_token     :string
#  confirmed_at           :datetime
#  confirmation_sent_at   :datetime
#  unconfirmed_email      :string
#  first_name             :string
#  last_name              :string
#  time_zone              :string
#  accepted_terms_at      :datetime
#  accepted_privacy_at    :datetime
#  announcements_read_at  :datetime
#  admin                  :boolean
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#  invitation_token       :string
#  invitation_created_at  :datetime
#  invitation_sent_at     :datetime
#  invitation_accepted_at :datetime
#  invitation_limit       :integer
#  invited_by_type        :string
#  invited_by_id          :integer
#  invitations_count      :integer          default("0")
#  preferred_language     :string
#  otp_required_for_login :boolean
#  otp_secret             :string
#  last_otp_timestep      :integer
#  otp_backup_codes       :text
#  preferences            :jsonb
#  name                   :string
#  jti                    :string
#
# Indexes
#
#  index_users_on_email                              (email) UNIQUE
#  index_users_on_invitation_token                   (invitation_token) UNIQUE
#  index_users_on_invitations_count                  (invitations_count)
#  index_users_on_invited_by_id                      (invited_by_id)
#  index_users_on_invited_by_type_and_invited_by_id  (invited_by_type,invited_by_id)
#  index_users_on_jti                                (jti) UNIQUE
#  index_users_on_reset_password_token               (reset_password_token) UNIQUE
#

require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "user has many accounts" do
    user = users(:one)
    assert_includes user.accounts, accounts(:one)
    assert_includes user.accounts, accounts(:company)
  end

  test "user has a personal account" do
    user = users(:one)
    assert_equal accounts(:one), user.personal_account
  end

  test "can delete user with accounts" do
    assert_difference "User.count", -1 do
      users(:one).destroy
    end
  end

  test "renders name with ActionText to_plain_text" do
    user = users(:one)
    assert_equal user.name, user.attachable_plain_text_representation
  end

  test "can search users by name generated column" do
    assert_equal users(:one), User.search("one").first
  end
end
