class SubscribedController < ApplicationController
  include Webcontainer
  before_action :refresh_jwt, if: proc { !request.format.json? && jwt_expired? }
  before_action :authenticate_with_jwt!, if: proc { request.format.json? }
  before_action :require_subscription!, unless: -> { Plan.none? }

  def root_path
    request.base_url
  end

  def langgraph_path
    Langgraph.url
  end

  inertia_share do
    flash_messages = []

    flash_messages << {type: "success", message: flash[:notice]} if flash[:notice]

    flash_messages << {type: "error", message: flash[:error]} if flash[:error]

    flash_messages << {type: "info", message: flash[:info]} if flash[:info]

    {
      root_path: root_path,
      langgraph_path: langgraph_path,
      jwt: cookies[:jwt],
      errors: session.delete(:errors) || {},
      flash: flash_messages
    }
  end
end
