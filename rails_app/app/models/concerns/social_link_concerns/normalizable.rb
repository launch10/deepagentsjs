module SocialLinkConcerns
  module Normalizable
    extend ActiveSupport::Concern

    NORMALIZABLE_PLATFORMS = %w[twitter instagram youtube].freeze

    included do
      before_validation :normalize_url
    end

    private

    def normalize_url
      return if url.blank?
      return unless NORMALIZABLE_PLATFORMS.include?(platform)

      self.url = send("normalize_#{platform}_url")
    end

    def normalize_twitter_url
      username = extract_twitter_username(url.strip)
      return url if username.nil?

      "https://twitter.com/#{username}"
    end

    def extract_twitter_username(input)
      # Handle full URLs (twitter.com or x.com)
      if input.match?(%r{\A(https?://)?(www\.)?(twitter\.com|x\.com)/})
        match = input.match(%r{(twitter\.com|x\.com)/([^/?]+)})
        return match[2].chomp("/") if match
      end

      # Handle @username format
      return input[1..].chomp("/") if input.start_with?("@")

      # Handle plain username (no URL, no @)
      return input.chomp("/") unless input.include?("/") || input.include?(".")

      nil
    end

    def normalize_instagram_url
      username = extract_instagram_username(url.strip)
      return url if username.nil?

      "https://instagram.com/#{username}"
    end

    def extract_instagram_username(input)
      # Handle full URLs
      if input.match?(%r{\A(https?://)?(www\.)?instagram\.com/})
        match = input.match(%r{instagram\.com/([^/?]+)})
        return match[1].chomp("/") if match
      end

      # Handle @username format
      return input[1..].chomp("/") if input.start_with?("@")

      # Handle plain username (no URL, no @)
      return input.chomp("/") unless input.include?("/") || input.include?(".")

      nil
    end

    def normalize_youtube_url
      input = url.strip

      # Handle full URLs first - preserve special paths like /channel/ and /c/
      return normalize_youtube_full_url(input) if input.match?(%r{\A(https?://)?(www\.)?youtube\.com/})

      # Handle @username format
      return "https://youtube.com/#{input.chomp('/')}" if input.start_with?("@")

      # Handle plain username (assumes @ handle)
      return "https://youtube.com/@#{input.chomp('/')}" unless input.include?("/") || input.include?(".")

      input
    end

    def normalize_youtube_full_url(input)
      match = input.match(%r{youtube\.com(/[^?]+)?})
      return input unless match

      path = (match[1] || "").chomp("/")

      # For @ handles in URLs
      return "https://youtube.com#{path}" if path.match?(%r{\A/@})

      # For channel URLs (/channel/ID or /c/name)
      return "https://youtube.com#{path}" if path.match?(%r{\A/(channel|c)/})

      # For other paths, try to extract username
      if path.match?(%r{\A/([^/]+)\z})
        username = path[1..]
        return "https://youtube.com/@#{username}" unless username.start_with?("@")
        return "https://youtube.com/#{username}"
      end

      "https://youtube.com#{path}"
    end
  end
end
