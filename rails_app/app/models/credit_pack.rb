# == Schema Information
#
# Table name: credit_packs
#
#  id              :bigint           not null, primary key
#  credits         :integer          not null
#  currency        :string           default("usd")
#  name            :string           not null
#  price_cents     :integer          not null
#  visible         :boolean          default(TRUE)
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  stripe_price_id :string
#
# Indexes
#
#  index_credit_packs_on_name  (name) UNIQUE
#
class CreditPack < ApplicationRecord
  has_many :credit_pack_purchases

  validates :name, presence: true, uniqueness: true
  validates :credits, presence: true, numericality: { greater_than: 0 }
  validates :price_cents, presence: true, numericality: { greater_than: 0 }

  scope :visible, -> { where(visible: true) }
  scope :by_credits, -> { order(credits: :asc) }

  def price_dollars
    price_cents / 100.0
  end

  def credits_per_dollar
    credits / price_dollars
  end
end
