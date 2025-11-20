class API::V1::AccountsController < API::BaseController
  def index
    @accounts = current_user.accounts
    render "accounts/index"
  end
end
