module WebsiteUrlConcerns
  module Assignment
    extend ActiveSupport::Concern

    class_methods do
      # Assigns a domain + path to a website using the update-in-place pattern.
      # This reuses the existing WebsiteUrl record for the website (1:1 relationship),
      # preventing ID churn across domain/path changes.
      #
      # @param website [Website] The website to assign the domain to
      # @param domain [Domain] The domain to assign
      # @param path [String] The path (defaults to "/")
      # @param account [Account] The account (defaults to website's account)
      # @return [WebsiteUrl] The created or updated WebsiteUrl
      # @raise [ActiveRecord::RecordInvalid] If validation fails
      def assign_to_website!(website:, domain:, path: "/", account: nil)
        account ||= website.account

        # Update-in-place: reuse existing WebsiteUrl for this website
        website_url = website.website_url || website.build_website_url(account_id: account.id)
        website_url.assign_attributes(domain_id: domain.id, path: path, account_id: account.id)
        website_url.save!
        website_url
      end

      # Finds or creates a domain, then assigns it to a website.
      # Returns an error result if the domain is owned by another account.
      #
      # @param website [Website] The website to assign the domain to
      # @param domain_string [String] The domain name
      # @param path [String] The path (defaults to "/")
      # @param is_platform_subdomain [Boolean] Whether this is a platform subdomain
      # @param account [Account] The account (defaults to website's account)
      # @return [Hash] { success: true, domain:, website_url: } or { success: false, error: }
      def assign_domain_to_website(website:, domain_string:, path: "/", is_platform_subdomain: nil, account: nil)
        account ||= website.account
        is_platform_subdomain = domain_string.end_with?(".launch10.site") if is_platform_subdomain.nil?

        # Check if domain already exists (globally)
        existing_domain = Domain.unscoped.find_by(domain: domain_string)

        domain = if existing_domain
          if existing_domain.account_id == account.id
            existing_domain
          else
            return {success: false, error: "This domain is not available"}
          end
        else
          new_domain = account.domains.build(
            domain: domain_string,
            is_platform_subdomain: is_platform_subdomain
          )
          unless new_domain.save
            return {success: false, error: new_domain.errors.full_messages.join(", ")}
          end
          new_domain
        end

        begin
          website_url = assign_to_website!(website: website, domain: domain, path: path, account: account)
          {success: true, domain: domain, website_url: website_url}
        rescue ActiveRecord::RecordInvalid => e
          {success: false, error: e.message}
        end
      end
    end
  end
end
