class SubscribedController < ApplicationController
  include Webcontainer
  before_action :require_subscription!
  before_action :refresh_jwt, if: proc { !request.format.json? && jwt_expired? }

  def root_path
    request.base_url
  end

  inertia_share do
    flash_messages = []

    flash_messages << { type: "success", message: flash[:notice] } if flash[:notice]

    flash_messages << { type: "error", message: flash[:error] } if flash[:error]

    flash_messages << { type: "info", message: flash[:info] } if flash[:info]

    {
      root_path: root_path,
      errors: session.delete(:errors) || {},
      flash: flash_messages,
    }
  end
end
