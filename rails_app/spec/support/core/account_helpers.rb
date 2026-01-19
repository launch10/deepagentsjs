module AccountHelpers
  def create_account_with_user(user, account_name:, admin: true)
    account = create(:account, name: account_name)
    AccountUser.create!(account: account, user: user, roles: admin ? [:admin] : [])
    account
  end
end

RSpec.configure do |config|
  config.include AccountHelpers
end
