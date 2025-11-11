module Langgraph
  URL = ENV["LANGGRAPH_API_URL"]
  def self.url
    throw "LANGGRAPH_API_URL must be set. Update .env" if URL.blank?
    URL
  end
end

Langgraph.url # Throw on app load if not set