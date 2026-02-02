# Assigns a platform subdomain to a website
# Usage: await appScenario('assign_platform_subdomain', { website_id, subdomain?, path? })
#
# Options:
#   website_id: number - The website ID to assign the subdomain to
#   subdomain: string - Optional subdomain name (defaults to random)
#   path: string - Optional path (defaults to "/")
#
# Returns: { domain, website_url }

website_id = command_options[:website_id] || command_options["website_id"]
subdomain = command_options[:subdomain] || command_options["subdomain"] || "test-site-#{SecureRandom.hex(4)}"
path = command_options[:path] || command_options["path"] || "/"

website = Website.find(website_id)
account = website.account

raise "Account not found for website: #{website_id}" unless account

domain_name = "#{subdomain}.launch10.site"

# Create platform subdomain
domain = account.domains.create!(
  domain: domain_name,
  is_platform_subdomain: true
)

# Create website_url linking domain to website
website_url = WebsiteUrl.create!(
  domain: domain,
  website: website,
  account: account,
  path: path
)

logger.info "[assign_platform_subdomain] subdomain=#{subdomain} domain=#{domain.domain} website=#{website_id}"

{
  domain: {
    id: domain.id,
    domain: domain.domain,
    subdomain: subdomain,
    is_platform_subdomain: domain.is_platform_subdomain
  },
  website_url: {
    id: website_url.id,
    domain_id: website_url.domain_id,
    website_id: website_url.website_id,
    path: website_url.path
  }
}
