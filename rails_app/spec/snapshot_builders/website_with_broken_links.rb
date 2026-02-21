# frozen_string_literal: true

class WebsiteWithBrokenLinks < BaseBuilder
  def base_snapshot
    "website_deploy_step"
  end

  def output_name
    "website_with_broken_links"
  end

  def build
    website = Account.first.projects.first.website

    # Find and modify the Nav component to have broken anchor links
    nav_file = website.website_files.find_by(path: "src/components/Header.tsx")

    if nav_file
      # Replace valid anchor links with broken ones (pointing to non-existent IDs)
      new_content = nav_file.content
        .gsub("#testimonials", "#testimonials-borked")

      nav_file.update!(content: new_content)
      Rails.logger.info "Modified Nav.tsx with broken anchor links"
    else
      # Fallback: modify Footer if Nav doesn't exist
      footer_file = website.website_files.find_by(path: "src/components/Footer.tsx")

      if footer_file
        # Add placeholder href="#" links which are also considered broken
        new_content = footer_file.content.gsub(
          /href="[^"]*"/,
          'href="#"'
        )
        footer_file.update!(content: new_content)
        Rails.logger.info "Modified Footer.tsx with placeholder href='#' links"
      else
        raise "Neither Nav.tsx nor Footer.tsx found - cannot create broken links"
      end
    end

    Rails.logger.info "Applied broken link modifications to website #{website.id}"
    website
  end
end
