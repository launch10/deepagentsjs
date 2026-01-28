module JwtHelpers
  def jwt_user
    test_jwt_user || real_jwt_user
  end

  def account_from_jwt
    test_jwt_account || real_jwt_account
  end

  def refresh_jwt(account: nil)
    set_request_details

    return unless current_user

    account ||= Current.account
    return unless account

    payload = {
      jti: current_user.jwt_payload["jti"],
      sub: current_user.id,
      account_id: account.id,
      exp: 24.hours.from_now.to_i,
      iat: Time.current.to_i
    }

    token = JWT.encode(payload, Rails.application.credentials.devise_jwt_secret_key!, "HS256")

    cookies[:jwt] = {
      value: token,
      httponly: true,
      secure: Rails.env.production?,
      same_site: :lax
    }
  end

  private

  def real_jwt_user
    sub = real_jwt_field("sub")
    return nil if sub.blank?

    User.find_by(id: sub)
  end

  def real_jwt_account
    account_id = real_jwt_field("account_id")
    return nil if account_id.blank?

    Account.find_by(id: account_id)
  end

  def real_jwt_field(field)
    jwt = get_jwt

    if jwt
      payload = jwt_payload
      return nil if payload.blank? || payload.dig(0, field).blank?

      payload.dig(0, field)
    end
  end

  def test_jwt_user
    return unless test_jwt_valid?
    User.find_by(email: "test_user@launch10.ai") # TODO: Update, this is only for Langgraph testing
  end

  def test_jwt_account
    return unless test_jwt_valid?
    test_jwt_user&.owned_account
  end

  def test_jwt_valid?
    can_use_test_jwt = Rails.env.development? || Rails.env.test?
    return nil unless can_use_test_jwt

    sent_test_proof = request.headers["X-Test-Proof"] && request.headers["X-Test-Mode"] == "true"
    return nil unless sent_test_proof

    test_proof = request.headers["X-Test-Proof"]
    return nil unless test_proof

    begin
      payload = JWT.decode(test_proof, Rails.application.credentials.devise_jwt_secret_key!, "HS256")[0]
      timestamp = payload["timestamp"].to_i

      # Check timestamp is recent (within last minute)
      if Time.at(timestamp / 1000) > 1.minute.ago
        true
      end
    rescue
      nil
    end
  end

  def jwt_expired?
    jwt_payload.nil?
  end

  def jwt_payload
    begin
      secret = Rails.application.credentials.devise_jwt_secret_key
      payload = JWT.decode(get_jwt, secret, true, {algorithm: "HS256"})
    rescue JWT::DecodeError
      return nil
    end
    payload
  end

  def get_jwt
    internal_api_request? ? request.headers["Authorization"]&.split(" ")&.last : cookies[:jwt]
  end
end
