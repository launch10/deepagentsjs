module InertiaConcerns
  extend ActiveSupport::Concern

  included do
    include InertiaRails::Controller
    protect_from_forgery with: :exception
  end
end