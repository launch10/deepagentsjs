module InertiaConcerns
  extend ActiveSupport::Concern

  included do
    include InertiaRails::Controller
    protect_from_forgery with: :exception
    protect_from_forgery with: :null_session, if: proc { |c| c.request.format.json? }
  end
end
