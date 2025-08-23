# == Schema Information
#
# Table name: api_tokens
#
#  id           :integer          not null, primary key
#  user_id      :integer          not null
#  token        :string
#  name         :string
#  metadata     :jsonb
#  transient    :boolean          default("false")
#  last_used_at :datetime
#  expires_at   :datetime
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#
# Indexes
#
#  index_api_tokens_on_token    (token) UNIQUE
#  index_api_tokens_on_user_id  (user_id)
#

class ApiToken < ApplicationRecord
  DEFAULT_NAME = I18n.t("api_tokens.default")
  APP_NAME = I18n.t("api_tokens.app")

  has_prefix_id :token
  has_secure_token :token

  belongs_to :user

  scope :sorted, -> { order(arel_table[:last_used_at].desc.nulls_last, created_at: :desc) }

  validates :name, presence: true

  def can?(permission)
    Array.wrap(data("permissions")).include?(permission)
  end

  def cant?(permission)
    !can?(permission)
  end

  def data(key, default: nil)
    (metadata || {}).fetch(key, default)
  end

  def expired?
    expires_at? && Time.current >= expires_at
  end

  def touch_last_used_at
    return if transient?
    update(last_used_at: Time.current)
  end

  def generate_token
    loop do
      self.token = SecureRandom.hex(16)
      break unless ApiToken.where(token: token).exists?
    end
  end
end
