module AccountSwitchingHelpers
  def switch_account_to(account)
    @current_test_account = account
  end

  def create_account_with_user(user, account_name:, admin: true)
    account = create(:account, name: account_name)
    AccountUser.create!(account: account, user: user, roles: admin ? [:admin] : [])
    account
  end
end
