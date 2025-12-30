module Langgraph
  def self.url
    url = ENV["LANGGRAPH_API_URL"]
    throw "LANGGRAPH_API_URL must be set. Update .env" if url.blank?
    url
  end
end

Langgraph.url # Throw on app load if not set
