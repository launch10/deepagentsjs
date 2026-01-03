require 'rails_helper'

RSpec.describe MediaUploader do
  let(:account) { create(:account) }
  let(:upload) { Upload.new(account: account, is_logo: is_logo) }
  let(:uploader) { MediaUploader.new(upload, :file) }
  let(:test_image_path) { Rails.root.join('spec/fixtures/files/test_image.jpg') }

  describe 'versions' do
    before do
      MediaUploader.enable_processing = true
      uploader.cache!(File.open(test_image_path))
      uploader.store!
    end

    after do
      uploader.remove!
      MediaUploader.enable_processing = false
    end

    context 'when is_logo is false' do
      let(:is_logo) { false }

      it 'creates thumb version' do
        expect(uploader.thumb).to be_present
      end

      it 'creates medium version' do
        expect(uploader.medium).to be_present
      end

      it 'does not create favicon version' do
        expect(uploader.favicon.file).to be_nil
      end
    end

    context 'when is_logo is true' do
      let(:is_logo) { true }

      it 'creates thumb version' do
        expect(uploader.thumb).to be_present
      end

      it 'creates medium version' do
        expect(uploader.medium).to be_present
      end

      it 'creates favicon version' do
        expect(uploader.favicon.file).to be_present
      end

      it 'resizes favicon to 32x32' do
        image = MiniMagick::Image.open(uploader.favicon.path)
        expect(image.width).to eq(32)
        expect(image.height).to eq(32)
      end

      it 'converts favicon to ICO format' do
        expect(uploader.favicon.file.extension).to eq('ico')
      end

      it 'names favicon file favicon.ico' do
        expect(File.basename(uploader.favicon.path)).to eq('favicon.ico')
      end
    end
  end

  describe 'SVG sanitization' do
    let(:is_logo) { false }

    before do
      # Enable processing for SVG sanitization to run
      MediaUploader.enable_processing = true
    end

    after do
      uploader.remove! if uploader.file.present?
      MediaUploader.enable_processing = false
    end

    context 'with SVG containing script tags' do
      let(:svg_path) { Rails.root.join('spec/fixtures/files/malicious_script.svg') }

      it 'removes script tags during upload' do
        uploader.cache!(File.open(svg_path))

        cached_content = File.read(uploader.path)
        expect(cached_content).not_to include('<script')
        expect(cached_content).not_to include('alert')
        expect(cached_content).not_to include('</script>')
      end

      it 'preserves valid SVG structure' do
        uploader.cache!(File.open(svg_path))

        cached_content = File.read(uploader.path)
        expect(cached_content).to include('<svg')
        expect(cached_content).to include('<rect')
        expect(cached_content).to include('<circle')
      end
    end

    context 'with SVG containing event handlers' do
      let(:svg_path) { Rails.root.join('spec/fixtures/files/malicious_onload.svg') }

      it 'removes onload attribute' do
        uploader.cache!(File.open(svg_path))

        cached_content = File.read(uploader.path)
        # Check for onload= attribute pattern (not just "onload" substring which appears in title)
        expect(cached_content).not_to match(/onload\s*=/)
      end

      it 'removes onclick attribute' do
        uploader.cache!(File.open(svg_path))

        cached_content = File.read(uploader.path)
        expect(cached_content).not_to match(/onclick\s*=/)
      end

      it 'removes onmouseover attribute' do
        uploader.cache!(File.open(svg_path))

        cached_content = File.read(uploader.path)
        expect(cached_content).not_to match(/onmouseover\s*=/)
      end
    end

    context 'with SVG containing javascript: URLs' do
      let(:svg_path) { Rails.root.join('spec/fixtures/files/malicious_javascript_url.svg') }

      it 'removes javascript: from href attributes' do
        uploader.cache!(File.open(svg_path))

        cached_content = File.read(uploader.path)
        expect(cached_content).not_to include('javascript:')
      end

      it 'removes javascript: from xlink:href attributes' do
        uploader.cache!(File.open(svg_path))

        cached_content = File.read(uploader.path)
        expect(cached_content).not_to match(/xlink:href\s*=\s*["']javascript:/i)
      end
    end

    context 'with clean SVG' do
      let(:svg_path) { Rails.root.join('spec/fixtures/files/clean.svg') }

      it 'preserves all content unchanged' do
        original_content = File.read(svg_path)
        uploader.cache!(File.open(svg_path))

        cached_content = File.read(uploader.path)
        expect(cached_content).to eq(original_content)
      end
    end

    context 'with non-SVG files' do
      let(:jpg_path) { Rails.root.join('spec/fixtures/files/test_image.jpg') }

      it 'does not modify non-SVG files' do
        original_content = File.binread(jpg_path)
        uploader.cache!(File.open(jpg_path))

        cached_content = File.binread(uploader.path)
        expect(cached_content).to eq(original_content)
      end
    end

    context 'with PDF files' do
      let(:pdf_path) { Rails.root.join('spec/fixtures/files/test_document.pdf') }

      it 'does not modify PDF files' do
        original_content = File.binread(pdf_path)
        uploader.cache!(File.open(pdf_path))

        cached_content = File.binread(uploader.path)
        expect(cached_content).to eq(original_content)
      end
    end
  end
end
