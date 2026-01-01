module Langgraph
  def self.url
    url = ENV["LANGGRAPH_API_URL"]
    throw "LANGGRAPH_API_URL must be set. Update .env" if url.blank?
    url
  end
end

# Debug: Show what URL is being used on startup
Rails.logger.info "[Langgraph] RAILS_ENV=#{Rails.env}, LANGGRAPH_API_URL=#{Langgraph.url}"
puts "[Langgraph] RAILS_ENV=#{Rails.env}, LANGGRAPH_API_URL=#{Langgraph.url}"
