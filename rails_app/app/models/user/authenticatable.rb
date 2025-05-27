module User::Authenticatable
  extend ActiveSupport::Concern

  included do
    include User::TwoFactorAuthentication
    include Devise::JWT::RevocationStrategies::JTIMatcher

    OPTIONS = [
      :database_authenticatable,
      :registerable,
      :recoverable,
      :rememberable,
      :validatable,
      # :confirmable,
      :jwt_authenticatable,
      (:omniauthable if defined? OmniAuth),
    ].compact

    devise(*OPTIONS, jwt_revocation_strategy: self)
    has_referrals if defined?(::Refer)

    has_many :api_tokens, dependent: :destroy
    has_many :connected_accounts, as: :owner, dependent: :destroy

    attr_readonly :admin
  end
end
