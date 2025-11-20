module UploadConcerns
  module Creation
    extend ActiveSupport::Concern

    class_methods do
      def create_upload!(account, upload_params)
        transaction do
          upload = account.uploads.create!(upload_params.except(:website_id))
          if upload_params[:website_id].present?
            website = account.websites.find_by!(id: upload_params[:website_id])
            WebsiteUpload.create!(website: website, upload: upload)
          end

          return {
            upload: upload
          }
        end
      end
    end
  end
end
