# Sets credits for an account
# Usage: await appScenario('set_credits', { email, plan_millicredits, pack_millicredits })
#
# Options:
#   email: string - User's email address
#   plan_millicredits: number - Plan credits in millicredits (1000 = 1 credit)
#   pack_millicredits: number - Pack credits in millicredits (default 0)

email = command_options[:email] || command_options["email"]
plan = command_options[:plan_millicredits] || command_options["plan_millicredits"] || 0
pack = command_options[:pack_millicredits] || command_options["pack_millicredits"] || 0

user = User.find_by!(email: email)
account = user.owned_account

raise "Account not found for user: #{email}" unless account

# Find or create a test admin for the audit trail
admin = User.find_by(admin: true) || User.find_by(email: "brett@launch10.com")

Credits::AllocationService.new(account).adjust_credits!(
  plan_millicredits: plan,
  pack_millicredits: pack,
  reason: "e2e_test_setup",
  admin: admin,
  notes: "Set via e2e scenario",
  idempotency_key: "e2e_test:#{account.id}:#{Time.current.to_i}"
)

account.reload

logger.info "[set_credits] account=#{account.id} plan=#{account.plan_millicredits} pack=#{account.pack_millicredits}"

{
  account_id: account.id,
  plan_millicredits: account.plan_millicredits,
  pack_millicredits: account.pack_millicredits,
  total_millicredits: account.total_millicredits
}
