# frozen_string_literal: true

class API::V1::JwtsController < API::BaseController
  def create
    refresh_jwt
    render json: {jwt: cookies[:jwt]}
  end
end
