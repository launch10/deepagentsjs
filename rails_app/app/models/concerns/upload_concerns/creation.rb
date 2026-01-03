module UploadConcerns
  module Creation
    extend ActiveSupport::Concern

    class_methods do
      def create_upload!(account, upload_params)
        Upload.transaction do
          upload_attrs = upload_params.except(:website_id)
          website = nil

          if upload_params[:website_id].present?
            website = account.websites.find_by!(id: upload_params[:website_id])
          end

          upload = account.uploads.create!(upload_attrs)

          # Create website_upload association if website provided
          # Project is derived through: upload -> websites -> project
          WebsiteUpload.create!(website: website, upload: upload) if website.present?

          {
            upload: upload
          }
        end
      end
    end
  end
end
