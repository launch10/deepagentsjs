# Creates platform subdomains to fill up the account's subdomain limit
# Usage: await appScenario('fill_subdomain_limit', { email })
#
# Options:
#   email: string - User's email address
#
# Returns: { subdomains_created, limit, used }

email = command_options[:email] || command_options["email"]

user = User.find_by!(email: email)
account = user.owned_account

raise "Account not found for user: #{email}" unless account

limit = account.plan&.limit_for("platform_subdomains") || 0
current_count = account.domains.platform_subdomains.count
domains_to_create = limit - current_count

logger.info "[fill_subdomain_limit] account=#{account.id} limit=#{limit} current=#{current_count} to_create=#{domains_to_create}"

created = 0
domains_to_create.times do
  domain_name = "test-subdomain-#{SecureRandom.hex(4)}.launch10.site"
  domain = account.domains.create!(
    domain: domain_name,
    is_platform_subdomain: true
  )
  created += 1 if domain.persisted?
end

final_count = account.domains.platform_subdomains.count
logger.info "[fill_subdomain_limit] DONE created=#{created} final_count=#{final_count}"

{
  subdomains_created: created,
  limit: limit,
  used: final_count
}
