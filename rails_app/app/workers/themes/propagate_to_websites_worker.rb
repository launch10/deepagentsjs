# frozen_string_literal: true

module Themes
  class PropagateToWebsitesWorker
    include Sidekiq::Worker

    sidekiq_options queue: :default, retry: 3

    def perform(theme_id)
      theme = Theme.find_by(id: theme_id)
      return unless theme

      theme.websites.find_in_batches do |batch|
        batch.each do |website|
          PerformOne.perform_async(website.id)
        end
      end
    end

    class PerformOne
      include Sidekiq::Worker

      def perform(website_id)
        website = Website.find(website_id)
        website.inject_theme_css!
      end
    end

  end
end

