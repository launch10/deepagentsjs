class WebcontainerController < ApplicationController
  include Webcontainer
  before_action :require_subscription!
end
