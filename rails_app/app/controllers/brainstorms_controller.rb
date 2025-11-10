class BrainstormsController < SubscribedController
  def new
    respond_to do |format|
      format.html do
        render inertia: 'Brainstorm', props: {
        }, layout: "layouts/webcontainer"
      end
    end
  end
end