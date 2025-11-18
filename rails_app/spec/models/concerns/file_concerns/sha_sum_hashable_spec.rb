require 'rails_helper'
RSpec.describe 'FileConcerns::ShasumHashable' do
  let(:template) { create(:template) }
  let(:website) { create(:website, template: template) }

  describe WebsiteFile do
    let(:website_file) { build(:website_file, website: website, path: '/index.html', content: '<h1>Hello</h1>') }

    describe '#generate_shasum' do
      it 'generates a SHA256 hash of path and content' do
        # Path setter removes leading slash
        expected_shasum = Digest::SHA256.hexdigest("index.html<h1>Hello</h1>")
        expect(website_file.generate_shasum).to eq(expected_shasum)
      end

      it 'generates different shasums for different content' do
        file1 = build(:website_file, path: '/index.html', content: 'content1')
        file2 = build(:website_file, path: '/index.html', content: 'content2')

        expect(file1.generate_shasum).not_to eq(file2.generate_shasum)
      end

      it 'generates different shasums for different paths' do
        file1 = build(:website_file, path: '/path1.html', content: 'content')
        file2 = build(:website_file, path: '/path2.html', content: 'content')

        expect(file1.generate_shasum).not_to eq(file2.generate_shasum)
      end
    end

    describe 'shasum persistence' do
      it 'saves shasum when creating a new file' do
        website_file.save!
        expect(website_file.reload.shasum).to eq(website_file.generate_shasum)
      end

      it 'updates shasum when content changes' do
        website_file.save!
        old_shasum = website_file.shasum

        website_file.content = '<h1>Updated</h1>'
        website_file.save!

        expect(website_file.reload.shasum).not_to eq(old_shasum)
        expect(website_file.shasum).to eq(website_file.generate_shasum)
      end

      it 'updates shasum when path changes' do
        website_file.save!
        old_shasum = website_file.shasum

        website_file.path = '/new-path.html'
        website_file.save!

        expect(website_file.reload.shasum).not_to eq(old_shasum)
        expect(website_file.shasum).to eq(website_file.generate_shasum)
      end

      it 'does not update shasum when neither path nor content changes' do
        website_file.save!
        old_shasum = website_file.shasum

        website_file.updated_at = Time.current
        website_file.save!

        expect(website_file.reload.shasum).to eq(old_shasum)
      end
    end
  end

  describe TemplateFile do
    let(:template) { create(:template) }
    let(:template_file) { build(:template_file, template: template, path: '/template.html', content: '<div>Template</div>') }

    describe '#generate_shasum' do
      it 'generates a SHA256 hash of path and content' do
        # Path setter removes leading slash
        expected_shasum = Digest::SHA256.hexdigest("template.html<div>Template</div>")
        expect(template_file.generate_shasum).to eq(expected_shasum)
      end
    end

    describe 'shasum persistence' do
      it 'saves shasum when creating a new file' do
        template_file.save!
        expect(template_file.reload.shasum).to eq(template_file.generate_shasum)
      end

      it 'updates shasum when content changes' do
        template_file.save!
        old_shasum = template_file.shasum

        template_file.content = '<div>Updated Template</div>'
        template_file.save!

        expect(template_file.reload.shasum).not_to eq(old_shasum)
        expect(template_file.shasum).to eq(template_file.generate_shasum)
      end
    end
  end

  describe "File comparisons" do
    let(:website_file_unchanged) { build(:website_file, path: '/index.html', content: 'content1') }
    let(:website_file_changed) { build(:website_file, path: '/index.html', content: 'content2') }
    let(:template_file) { build(:template_file, path: '/index.html', content: 'content1') }
    let(:website_file_different_path_same_content) { build(:website_file, path: '/index2.html', content: 'content1') }

    it 'returns true when files are equal' do
      expect(website_file_unchanged).to eq(template_file)
    end

    it 'returns false when files are not equal' do
      expect(website_file_changed).not_to eq(template_file)
    end

    it 'returns false when files have different paths' do
      expect(website_file_different_path_same_content).not_to eq(template_file)
    end

    it "supers when comparing with things that don't have a shasum" do
      expect(website_file_unchanged).to_not eq(1)
    end

    it "allows filtering by equality" do
      filtered_files = [
        website_file_unchanged,
        website_file_changed
      ].select { |f| f != template_file }

      expect(filtered_files).to eq([website_file_changed])
    end
  end
end
