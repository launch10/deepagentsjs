# frozen_string_literal: true

# Centralizes conversion between credits and millicredits.
#
# Credits are the user-facing unit (1 credit = 1 cent of LLM cost).
# Millicredits are the internal storage unit (1 millicredit = 0.001 credits).
#
# We store millicredits internally to avoid floating point precision issues
# while still allowing sub-credit granularity in cost calculations.
#
module Millicredits
  FACTOR = 1000

  # Convert credits to millicredits for storage
  # @param credits [Numeric] Credits (user-facing unit)
  # @return [Integer] Millicredits (storage unit)
  def self.from_credits(credits)
    (credits * FACTOR).to_i
  end

  # Convert millicredits to credits for display
  # @param millicredits [Integer] Millicredits (storage unit)
  # @return [Float] Credits (user-facing unit)
  def self.to_credits(millicredits)
    millicredits / FACTOR.to_f
  end
end
