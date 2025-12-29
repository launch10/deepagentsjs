require_relative "application"
require "dotenv"

# Load environment-specific .env file first (e.g., .env.test), then fallback to .env
Dotenv.load(".env.#{Rails.env}", ".env")
Rails.application.initialize!
