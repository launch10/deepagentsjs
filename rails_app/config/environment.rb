require_relative "application"
require "dotenv"

# Load .env first for base defaults, then environment-specific file to override
# Dotenv.load won't override already-set vars, so we use overload for env-specific
Dotenv.load(".env")
env_file = ".env.#{Rails.env}"
Dotenv.overload(env_file) if File.exist?(env_file)

Rails.application.initialize!
