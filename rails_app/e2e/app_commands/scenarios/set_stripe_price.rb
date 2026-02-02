# Sets stripe_price_id on a credit pack
# Usage: await appScenario('set_stripe_price', { credit_pack_id, stripe_price_id })
#
# Options:
#   credit_pack_id: number - The credit pack ID
#   stripe_price_id: string - The Stripe price ID to set
#
# Returns: { credit_pack }

credit_pack_id = command_options[:credit_pack_id] || command_options["credit_pack_id"]
stripe_price_id = command_options[:stripe_price_id] || command_options["stripe_price_id"]

credit_pack = CreditPack.find(credit_pack_id)
credit_pack.update!(stripe_price_id: stripe_price_id)

logger.info "[set_stripe_price] credit_pack=#{credit_pack_id} stripe_price_id=#{stripe_price_id}"

{
  credit_pack: {
    id: credit_pack.id,
    name: credit_pack.name,
    stripe_price_id: credit_pack.stripe_price_id
  }
}
