require 'rails_helper'

RSpec.describe WebsiteConcerns::FileManagement do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:template) { create(:template) }
  let(:website) { create(:website, project: project, account: account, template: template) }
  
  # Create template files
  let!(:template_file1) do
    create(:template_file, 
      template: template, 
      path: '/index.html', 
      content: '<h1>Template Index</h1>'
    )
  end
  
  let!(:template_file2) do
    create(:template_file, 
      template: template, 
      path: '/styles.css', 
      content: 'body { background: white; }'
    )
  end

  describe '#website_files_attributes=' do
    context 'when creating new website_files' do
      it 'filters out files identical to template files' do
        attributes = [
          { path: '/index.html', content: '<h1>Template Index</h1>' }, # Duplicate - should be filtered
          { path: '/styles.css', content: 'body { background: white; }' }, # Duplicate - should be filtered
          { path: '/about.html', content: '<h1>About</h1>' } # New path - should be kept
        ]
        
        website.website_files_attributes = attributes
        website.save!
        
        # Should only have the about page (template duplicates filtered)
        expect(website.website_files.count).to eq(1)
        expect(website.website_files.pluck(:path)).to contain_exactly('about.html')
        
        about_file = website.website_files.find_by(path: 'about.html')
        expect(about_file.content).to eq('<h1>About</h1>')
      end
      
      it 'adds validation error when duplicate paths are provided' do
        attributes = [
          { path: '/index.html', content: '<h1>Custom Index 1</h1>' },
          { path: '/index.html', content: '<h1>Custom Index 2</h1>' }, # Duplicate path!
          { path: '/about.html', content: '<h1>About</h1>' }
        ]
        
        website.website_files_attributes = attributes
        
        # Validation happens on save
        expect(website.save).to be false
        expect(website.errors[:website_files]).to include("cannot have multiple files with the same path")
        expect(website.website_files.count).to eq(0) # No files should be created
      end
    end
    
    context 'when updating existing website_files' do
      let!(:custom_index) do
        website.website_files.create!(
          path: '/index.html',
          content: '<h1>Custom Index</h1>'
        )
      end
      
      let!(:custom_about) do
        website.website_files.create!(
          path: '/about.html',
          content: '<h1>About Page</h1>'
        )
      end
      
      it 'marks files for destruction when updated to match template' do
        attributes = [
          { 
            id: custom_index.id, 
            content: '<h1>Template Index</h1>' # Now matches template
          },
          {
            id: custom_about.id,
            content: '<h1>Updated About</h1>' # Still custom
          }
        ]
        
        website.website_files_attributes = attributes
        website.save!
        
        # Index file should be destroyed
        expect(website.website_files.exists?(custom_index.id)).to be false
        
        # About file should still exist with updated content
        expect(website.website_files.exists?(custom_about.id)).to be true
        expect(custom_about.reload.content).to eq('<h1>Updated About</h1>')
      end
      
      it 'keeps files that remain different from template' do
        attributes = [
          { 
            id: custom_index.id, 
            content: '<h1>Another Custom Index</h1>' # Still different
          }
        ]
        
        website.website_files_attributes = attributes
        website.save!
        
        expect(website.website_files.exists?(custom_index.id)).to be true
        expect(custom_index.reload.content).to eq('<h1>Another Custom Index</h1>')
      end
    end
  end
  
  describe '#duplicate_of_template?' do
    it 'returns true for identical files' do
      expect(website.duplicate_of_template?('/index.html', '<h1>Template Index</h1>')).to be true
    end
    
    it 'returns false for different content' do
      expect(website.duplicate_of_template?('/index.html', '<h1>Custom Index</h1>')).to be false
    end
    
    it 'returns false for non-existent template paths' do
      expect(website.duplicate_of_template?('/new.html', '<h1>Template Index</h1>')).to be false
    end
  end
  
  describe '#remove_duplicate_website_files!' do
    before do
      # Create some website_files - some duplicate, some custom
      @duplicate_index = website.website_files.create!(
        path: '/index.html',
        content: '<h1>Template Index</h1>' # Duplicate
      )
      @duplicate_styles = website.website_files.create!(
        path: '/styles.css',
        content: 'body { background: white; }' # Duplicate
      )
      @custom_about = website.website_files.create!(
        path: '/about.html',
        content: '<h1>About</h1>' # New file
      )
      @custom_script = website.website_files.create!(
        path: '/script.js',
        content: 'console.log("custom");' # New file
      )
    end
    
    it 'removes website_files that duplicate template_files' do
      initial_count = website.website_files.count
      expect(initial_count).to eq(4)
      
      website.remove_duplicate_website_files!
      
      # Should have removed the 2 duplicates
      expect(website.website_files.count).to eq(2)
      
      # Should keep only non-duplicate files
      expect(website.website_files.pluck(:path).sort).to eq(['about.html', 'script.js'])
      
      # Verify remaining files are not duplicates
      website.website_files.reload.each do |wf|
        expect(website.duplicate_of_template?(wf.path, wf.content)).to be false
      end
    end
  end
  
  describe '#files' do
    before do
      # Create a custom index that overrides template
      website.website_files.create!(
        path: '/index.html',
        content: '<h1>Custom Index</h1>'
      )
      # Create a new file not in template
      website.website_files.create!(
        path: '/about.html',
        content: '<h1>About</h1>'
      )
    end
    
    it 'returns merged files with website_files overriding template_files' do
      files = website.files
      paths = files.map(&:path).sort
      
      # Should have custom index, template styles, and about
      expect(paths).to eq(['about.html', 'index.html', 'styles.css'])
      
      # Verify index is the custom one
      index = files.find { |f| f.path == 'index.html' }
      expect(index.content).to eq('<h1>Custom Index</h1>')
      expect(index).to be_a(CodeFile)
      expect(index.source).to eq('website')
      
      # Verify styles is from template
      styles = files.find { |f| f.path == 'styles.css' }
      expect(styles.content).to eq('body { background: white; }')
      expect(styles).to be_a(CodeFile)
      expect(styles.source).to eq('template')
    end
  end
  
  describe 'path uniqueness validation' do
    it 'prevents creating multiple files with the same path' do
      # First file creates successfully
      file1 = website.website_files.create(path: '/test.html', content: 'content1')
      expect(file1).to be_persisted
      
      # Second file with same path should fail
      file2 = website.website_files.build(path: '/test.html', content: 'content2')
      expect(file2).not_to be_valid
      expect(file2.errors[:path]).to include("already exists for this website")
    end
    
    it 'allows same path across different websites' do
      other_website = create(:website, project: project, account: account, template: template)
      
      file1 = website.website_files.create!(path: '/test.html', content: 'content1')
      file2 = other_website.website_files.create!(path: '/test.html', content: 'content2')
      
      expect(file1).to be_persisted
      expect(file2).to be_persisted
    end
  end
  
  describe 'integration with nested forms' do
    it 'handles complex nested attributes with duplicate paths correctly' do
      # Simulate a form submission with duplicate paths
      attributes = {
        "0" => { path: '/index.html', content: '<h1>Custom Index 1</h1>' },
        "1" => { path: '/index.html', content: '<h1>Custom Index 2</h1>' }, # Duplicate path!
        "2" => { path: '/new.html', content: '<h1>New Page</h1>' },
        "3" => { path: '/styles.css', content: 'body { color: blue; }' }
      }
      
      website.website_files_attributes = attributes
      
      # Should add validation error on save
      expect(website.save).to be false
      expect(website.errors[:website_files]).to include("cannot have multiple files with the same path")
      expect(website.website_files.count).to eq(0)
    end
    
    it 'handles template duplicates without path conflicts' do
      attributes = {
        "0" => { path: '/index.html', content: '<h1>Template Index</h1>' }, # Template duplicate
        "1" => { path: '/new.html', content: '<h1>New Page</h1>' },
        "2" => { path: '/styles.css', content: 'body { color: blue; }' } # Custom styles
      }
      
      website.website_files_attributes = attributes
      website.save!
      
      # Template duplicate filtered, others saved
      expect(website.website_files.pluck(:path).sort).to eq(['new.html', 'styles.css'])
      
      # Verify content
      new_page = website.website_files.find_by(path: 'new.html')
      expect(new_page.content).to eq('<h1>New Page</h1>')
      
      styles = website.website_files.find_by(path: 'styles.css')
      expect(styles.content).to eq('body { color: blue; }')
    end
  end
end