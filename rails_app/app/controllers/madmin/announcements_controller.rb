module Madmin
  class AnnouncementsController < Madmin::ResourceController
    def index
      @announcements = ::Announcement.order(published_at: :desc)

      render inertia: "Madmin/Announcements/Index",
        props: {
          announcements: @announcements.map { |a| serialize_announcement(a) }
        }
    end

    def show
      @announcement = ::Announcement.find(params[:id])

      render inertia: "Madmin/Announcements/Show",
        props: {
          announcement: serialize_announcement(@announcement, detailed: true)
        }
    end

    private

    def serialize_announcement(announcement, detailed: false)
      data = {
        id: announcement.id,
        kind: announcement.kind,
        title: announcement.title,
        published: announcement.published_at.present?,
        publishedAt: announcement.published_at&.iso8601,
        createdAt: announcement.created_at&.iso8601
      }

      if detailed
        data.merge!(
          description: announcement.description&.to_plain_text,
          descriptionHtml: announcement.description&.to_s,
          updatedAt: announcement.updated_at&.iso8601
        )
      end

      data
    end
  end
end
