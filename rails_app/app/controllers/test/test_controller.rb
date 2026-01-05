class Test::TestController < ApplicationController
  skip_forgery_protection
  before_action :redirect_unless_local_env

  private

  def redirect_unless_local_env
    unless Rails.env.local?  # Allows both development and test environments
      redirect_to root_path
    end
  end
end
