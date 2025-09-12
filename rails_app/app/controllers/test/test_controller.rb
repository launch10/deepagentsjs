class Test::TestController < ApplicationController
  before_action :redirect_unless_test_env

private
  def redirect_unless_test_env
    unless Rails.env.test?
      redirect_to root_path
    end
  end
end