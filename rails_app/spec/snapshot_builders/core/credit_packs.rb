module Core
  class CreditPacks < BaseBuilder
    def seed
      puts "Seeding credit packs..."

      credit_packs = [
        # Small Pack: 500 credits for $25 ($0.05/credit)
        {
          name: "small",
          credits: 500,
          price_cents: 2500,
          currency: "usd",
          stripe_price_id: Rails.application.credentials.dig(:stripe, :credit_packs, :small),
          visible: true
        },
        # Medium Pack: 1,250 credits for $50 ($0.04/credit)
        {
          name: "medium",
          credits: 1250,
          price_cents: 5000,
          currency: "usd",
          stripe_price_id: Rails.application.credentials.dig(:stripe, :credit_packs, :medium),
          visible: true
        },
        # Big Pack: 3,000 credits for $100 (~$0.033/credit)
        {
          name: "big",
          credits: 3000,
          price_cents: 10000,
          currency: "usd",
          stripe_price_id: Rails.application.credentials.dig(:stripe, :credit_packs, :big),
          visible: true
        }
      ]

      packs = credit_packs.map do |pack_attrs|
        CreditPack.find_or_initialize_by(name: pack_attrs[:name]) do |pack|
          pack.credits = pack_attrs[:credits]
          pack.price_cents = pack_attrs[:price_cents]
          pack.currency = pack_attrs[:currency]
          pack.stripe_price_id = pack_attrs[:stripe_price_id]
          pack.visible = pack_attrs[:visible]
        end
      end
      CreditPack.import(packs)

      puts "Credit packs seeded: #{CreditPack.count} packs"
    end
  end
end
