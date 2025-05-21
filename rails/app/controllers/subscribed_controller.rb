class SubscribedController < ApplicationController
  include Webcontainer
  before_action :require_subscription!
end
