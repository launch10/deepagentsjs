# == Schema Information
#
# Table name: code_files
#
#  website_id            :integer
#  path                  :string
#  content               :string
#  content_tsv           :tsvector
#  shasum                :string
#  file_specification_id :integer
#  source_type           :text
#  source_id             :integer
#  created_at            :datetime
#  updated_at            :datetime
#

class CodeFile < ApplicationRecord
# This is a read-only model backed by a database view
# The view merges template_files and website_files
#
  self.table_name = 'code_files'
  self.primary_key = nil # View doesn't have a primary key
  
  # Default ordering since the view has no primary key
  default_scope { order(created_at: :desc, path: :asc) }
  
  def readonly?
    true
  end
  
  belongs_to :website
  
  belongs_to :source_file, polymorphic: true, optional: true, 
    foreign_type: :source_type, foreign_key: :source_id
  
  # Scopes for full-text search
  scope :search, ->(query) {
    where("content_tsv @@ plainto_tsquery('english', ?)", query)
  }
  
  scope :search_with_rank, ->(query) {
    sanitized = connection.quote(query)
    search(query)
      .reselect("code_files.*, ts_rank(content_tsv, plainto_tsquery('english', #{sanitized})) AS rank")
      .order("rank DESC")
  }
  
  scope :search_phrase, ->(phrase) {
    where("content_tsv @@ phraseto_tsquery('english', ?)", phrase)
  }
  
  scope :search_boolean, ->(query) {
    where("content_tsv @@ to_tsquery('english', ?)", query)
  }
  
  # Fuzzy path search using trigrams
  def self.path_similar_to(path, threshold = 0.3)
    sanitized_path = connection.quote(path)
    
    # Use a subquery to avoid conflicts with default scope
    from(
      unscoped.select("code_files.*", "similarity(path, #{sanitized_path}) AS path_similarity"),
      :code_files
    ).where("similarity(path, ?) > ?", path, threshold)
     .order("path_similarity DESC")
  end
  
  scope :path_fuzzy, ->(pattern) {
    where("path % ?", pattern)
  }
  
  # Filter by source (website or template)
  scope :from_website, -> { where(source_type: 'WebsiteFile') }
  scope :from_template, -> { where(source_type: 'TemplateFile') }
  
  # Filter by polymorphic source
  scope :for_source, ->(source_type, source_id) { where(source_type: source_type, source_id: source_id) }
  scope :for_website_file, ->(website_file_id) { where(source_type: 'WebsiteFile', source_id: website_file_id) }
  scope :for_template_file, ->(template_file_id) { where(source_type: 'TemplateFile', source_id: template_file_id) }
  
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
    
    sanitized_query = connection.quote(query)
    highlight_col = "ts_headline('english', content, plainto_tsquery('english', #{sanitized_query}), 'StartSel=#{start_sel}, StopSel=#{stop_sel}, MaxWords=#{max_words}, MinWords=10') AS highlighted_content"
    
    # Use reselect to override any default select
    search(query)
      .reselect("code_files.*", highlight_col)
  end
  
  # Get top matching files with context  
  def self.search_with_context(query, limit = 10)
    sanitized_query = connection.quote(query)
    highlight_col = "ts_headline('english', content, plainto_tsquery('english', #{sanitized_query}), 'MaxWords=20, MinWords=10') AS highlighted_content"
    
    # Use reselect to override any default select
    search(query)
      .reselect("code_files.*", highlight_col)
      .limit(limit)
  end
  
  # Count matches per website
  def self.count_matches_by_website(query)
    search(query)
      .unscope(:order)  # Remove default ordering for grouped queries
      .group(:website_id)
      .count
  end
  
  def website_file?
    source_type == 'WebsiteFile'
  end
  
  def template_file?
    source_type == 'TemplateFile'
  end
  
  def source
    case source_type
    when 'WebsiteFile'
      'website'
    when 'TemplateFile'
      'template'
    else
      source_type
    end
  end
  
  def source_file_object
    case source_type
    when 'WebsiteFile'
      WebsiteFile.find_by(id: source_id)
    when 'TemplateFile'
      TemplateFile.find_by(id: source_id)
    end
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
