# Assigns a custom domain to a website
# Usage: await appScenario('assign_custom_domain', { website_id, domain_name?, path? })
#
# Options:
#   website_id: number - The website ID to assign the domain to
#   domain_name: string - Optional custom domain (defaults to random .example.com)
#   path: string - Optional path (defaults to "/")
#
# Returns: { domain, website_url }

website_id = command_options[:website_id] || command_options["website_id"]
domain_name = command_options[:domain_name] || command_options["domain_name"] || "test-custom-#{SecureRandom.hex(4)}.example.com"
path = command_options[:path] || command_options["path"] || "/"

website = Website.find(website_id)
account = website.account

raise "Account not found for website: #{website_id}" unless account

# Create custom domain (not a platform subdomain)
domain = account.domains.create!(
  domain: domain_name,
  is_platform_subdomain: false,
  dns_verification_status: "verified" # Mark as verified for testing
)

# Create website_url linking domain to website
website_url = WebsiteUrl.create!(
  domain: domain,
  website: website,
  account: account,
  path: path
)

logger.info "[assign_custom_domain] domain=#{domain.domain} website=#{website_id}"

{
  domain: {
    id: domain.id,
    domain: domain.domain,
    is_platform_subdomain: domain.is_platform_subdomain,
    dns_verification_status: domain.dns_verification_status
  },
  website_url: {
    id: website_url.id,
    domain_id: website_url.domain_id,
    website_id: website_url.website_id,
    path: website_url.path
  }
}
