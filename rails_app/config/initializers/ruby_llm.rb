RubyLLM.configure do |config|
  config.openai_api_key = Rails.application.credentials.dig(:openai, :api_key)
  config.default_embedding_model = "text-embedding-3-small"
  config.use_new_acts_as = true
end
