class UploadsController < SubscribedController
  before_action :authenticate_user!

  def index
    @uploads = current_account.uploads.order(created_at: :desc)
  end
end
