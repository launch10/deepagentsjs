module GoogleMappable
  extend ActiveSupport::Concern

  def to_google_json
    GoogleAds::Sync::FieldMappings.to_google(self)
  end

  class_methods do
    def from_google_json(google_resource)
      GoogleAds::Sync::FieldMappings.from_google(google_resource, self)
    end
  end
end
