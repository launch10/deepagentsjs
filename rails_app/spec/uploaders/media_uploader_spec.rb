require 'rails_helper'

RSpec.describe MediaUploader do
  let(:account) { create(:account) }
  let(:upload) { Upload.new(account: account, is_logo: is_logo) }
  let(:uploader) { MediaUploader.new(upload, :file) }
  let(:test_image_path) { Rails.root.join('spec/fixtures/files/test_image.jpg') }

  before do
    MediaUploader.enable_processing = true
    uploader.cache!(File.open(test_image_path))
    uploader.store!
  end

  after do
    uploader.remove!
    MediaUploader.enable_processing = false
  end

  describe 'versions' do
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
end
