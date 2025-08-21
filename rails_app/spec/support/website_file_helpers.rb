module WebsiteFileHelpers
  def valid_website_files
    @valid_website_files ||= JSON.parse(
      File.read(Rails.root.join('spec', 'fixtures', 'valid_website_files.json'))
    )
  end

  def website_files_attributes
    valid_website_files.map do |file|
      {
        path: file['path'],
        content: file['content']
      }
    end
  end

  def sample_website_files(count: 3)
    website_files_attributes.sample(count)
  end

  def website_files_for_create
    {
      files_attributes: website_files_attributes
    }
  end

  def minimal_website_files
    [
      {
        path: "index.html",
        content: "<html><body>Hello World</body></html>"
      },
      {
        path: "styles.css", 
        content: "body { background: #fff; }"
      }
    ]
  end

  def website_params_with_files(overrides = {})
    {
      website: {
        name: "Test Landing Page",
        thread_id: "thread_#{SecureRandom.hex(8)}",
        files_attributes: website_files_attributes
      }.merge(overrides)
    }
  end

  def create_website_with_files(user:, project:, files: nil)
    files ||= website_files_attributes
    
    website = Website.create!(
      name: "Test Website",
      thread_id: "thread_#{SecureRandom.hex(8)}",
      user: user,
      project: project
    )
    
    files.each do |file_attrs|
      website.files.create!(file_attrs)
    end
    
    website
  end
end

RSpec.configure do |config|
  config.include WebsiteFileHelpers
end