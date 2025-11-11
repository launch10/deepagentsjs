require 'rails_helper'

RSpec.describe 'WebsiteConcerns::ShasumHashable' do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:template) { create(:template) }
  let(:website) { create(:website, project: project, account: account, template: template) }

  describe '#generate_shasum' do
    context 'with website files' do
      let!(:file1) { create(:website_file, website: website, path: '/index.html', content: 'content1') }
      let!(:file2) { create(:website_file, website: website, path: '/style.css', content: 'content2') }

      it 'generates a SHA256 hash of all file shasums' do
        # Files should be sorted by path
        sorted_files = [file1, file2].sort_by(&:path)
        expected_shasum = Digest::SHA256.hexdigest(sorted_files.map(&:shasum).join)

        expect(website.generate_shasum).to eq(expected_shasum)
      end

      it 'generates different shasums when files change' do
        original_shasum = website.generate_shasum

        file1.update!(content: 'updated content')

        expect(website.generate_shasum).not_to eq(original_shasum)
      end

      it 'generates the same shasum for the same files' do
        shasum1 = website.generate_shasum
        shasum2 = website.generate_shasum

        expect(shasum1).to eq(shasum2)
      end
    end

    context 'with template files' do
      let!(:template_file1) { create(:template_file, template: template, path: '/base.html', content: 'base') }
      let!(:template_file2) { create(:template_file, template: template, path: '/header.html', content: 'header') }

      it 'includes template files in shasum calculation' do
        shasum = website.generate_shasum
        expect(shasum).to be_present
      end

      it 'generates different shasum when template files are overridden' do
        shasum_before = website.generate_shasum

        # Override a template file with a website file
        create(:website_file, website: website, path: '/base.html', content: 'overridden')

        shasum_after = website.generate_shasum
        expect(shasum_after).not_to eq(shasum_before)
      end
    end

    context 'with mixed files' do
      let!(:template_file) { create(:template_file, template: template, path: '/template.html', content: 'template') }
      let!(:website_file) { create(:website_file, website: website, path: '/custom.html', content: 'custom') }
      let!(:override_file) { create(:website_file, website: website, path: '/template.html', content: 'override') }

      it 'website files override template files with same path' do
        files = website.files
        template_file_in_result = files.find { |f| f.path == 'template.html' }

        expect(template_file_in_result).to be_a(CodeFile)
        expect(template_file_in_result.content).to eq('override')
        expect(template_file_in_result.source).to eq('website')
      end

      it 'includes both website and non-overridden template files' do
        files = website.files
        paths = files.map(&:path).sort

        expect(paths).to eq(['custom.html', 'template.html'])
      end
    end
  end

  describe '#files_changed?' do
    let!(:website_file) { create(:website_file, website: website, path: '/index.html', content: 'initial') }

    context 'with no deploys' do
      it 'returns true' do
        expect(website.files_changed?).to be true
      end
    end

    context 'with a completed deploy' do
      let!(:deploy) { create(:deploy, website: website, status: 'completed', shasum: website.generate_shasum) }

      it 'returns false when files have not changed' do
        expect(website.files_changed?).to be false
      end

      it 'returns true when files have changed' do
        original_file_shasum = website_file.shasum
        website_file.update!(content: 'changed')
        website_file.reload

        # Debug: ensure file shasum changed
        expect(website_file.shasum).not_to eq(original_file_shasum), "File shasum didn't change: #{website_file.shasum}"

        expect(website.files_changed?).to be true
      end

      it 'returns true when new files are added' do
        create(:website_file, website: website, path: '/new.html', content: 'new')
        expect(website.files_changed?).to be true
      end

      it 'returns true when files are deleted' do
        website_file.destroy
        expect(website.files_changed?).to be true
      end
    end

    context 'with multiple deploys' do
      let!(:old_deploy) { create(:deploy, website: website, status: 'completed', shasum: 'old', created_at: 2.days.ago) }
      let!(:latest_deploy) { create(:deploy, website: website, status: 'completed', shasum: website.generate_shasum, created_at: 1.day.ago) }
      let!(:failed_deploy) { create(:deploy, website: website, status: 'failed', shasum: 'failed', created_at: 1.hour.ago) }

      it 'compares against the latest completed deploy' do
        expect(website.files_changed?).to be false

        website_file.update!(content: 'changed')
        expect(website.files_changed?).to be true
      end

      it 'ignores failed deploys' do
        # Even though failed_deploy is more recent, it should compare against latest_deploy
        expect(website.deploys.completed.order(created_at: :desc).first).to eq(latest_deploy)
      end
    end
  end
end
