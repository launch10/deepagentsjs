# == Schema Information
#
# This is a read-only model backed by a database view
# The view merges template_files and website_files
#
class CodeFile < ApplicationRecord
  self.table_name = 'code_files'
  self.primary_key = nil # View doesn't have a primary key
  
  # Make this model read-only since it's backed by a view
  def readonly?
    true
  end
  
  # Associations
  belongs_to :website
  
  # Scopes for full-text search
  scope :search, ->(query) {
    where("content_tsv @@ plainto_tsquery('english', ?)", query)
      .select("*, ts_rank(content_tsv, plainto_tsquery('english', ?)) AS rank", query)
      .order("rank DESC")
  }
  
  scope :search_phrase, ->(phrase) {
    where("content_tsv @@ phraseto_tsquery('english', ?)", phrase)
  }
  
  scope :search_boolean, ->(query) {
    where("content_tsv @@ to_tsquery('english', ?)", query)
  }
  
  # Fuzzy path search using trigrams
  scope :path_similar_to, ->(path, threshold = 0.3) {
    where("similarity(path, ?) > ?", path, threshold)
      .select("*, similarity(path, ?) AS path_similarity", path)
      .order("path_similarity DESC")
  }
  
  scope :path_fuzzy, ->(pattern) {
    where("path % ?", pattern)
  }
  
  # Filter by source (website or template)
  scope :from_website, -> { where(source: 'website') }
  scope :from_template, -> { where(source: 'template') }
  
  # Filter by file type
  scope :javascript, -> { where("path ILIKE '%.js' OR path ILIKE '%.jsx'") }
  scope :typescript, -> { where("path ILIKE '%.ts' OR path ILIKE '%.tsx'") }
  scope :css, -> { where("path ILIKE '%.css' OR path ILIKE '%.scss' OR path ILIKE '%.sass'") }
  scope :html, -> { where("path ILIKE '%.html' OR path ILIKE '%.htm'") }
  
  # Search with highlighting
  def self.search_with_highlights(query, options = {})
    start_sel = options[:start_sel] || '<mark>'
    stop_sel = options[:stop_sel] || '</mark>'
    max_words = options[:max_words] || 20
    
    search(query).select(
      "ts_headline('english', content, plainto_tsquery('english', ?), 
        'StartSel=#{start_sel}, StopSel=#{stop_sel}, MaxWords=#{max_words}, MinWords=10') AS highlighted_content",
      query
    )
  end
  
  # Get top matching files with context
  def self.search_with_context(query, limit = 10)
    search_with_highlights(query)
      .limit(limit)
      .select(:website_id, :path, :source)
  end
  
  # Count matches per website
  def self.count_matches_by_website(query)
    search(query)
      .group(:website_id)
      .count
  end
  
  # Instance methods
  def website_file?
    source == 'website'
  end
  
  def template_file?
    source == 'template'
  end
  
  def file_type
    File.extname(path).delete('.').downcase
  end
  
  def language
    case file_type
    when 'js', 'jsx' then 'javascript'
    when 'ts', 'tsx' then 'typescript'  
    when 'rb' then 'ruby'
    when 'py' then 'python'
    when 'css', 'scss', 'sass' then 'css'
    when 'html', 'htm' then 'html'
    else file_type
    end
  end
end