module Webcontainer
  extend ActiveSupport::Concern

  included do
    before_action :set_webcontainer_headers
    include InertiaConcerns
    layout "layouts/webcontainer"
  end

  # A main component of our application is the WebContainer, which is a
  # self-contained environment for running web applications.
  #
  # To enable the WebContainer, we need to follow strict security protocols, Cross-Origin-Opener-Policy (COOP)
  # and Cross-Origin-Embedder-Policy (COEP).
  #
  # These headers are necessary to enable a "cross-origin isolated" state, which
  # is a prerequisite for using powerful browser features like SharedArrayBuffer.
  #
  # SharedArrayBuffer is used by WebContainers for efficient multi-threading.
  # COOP: 'same-origin' restricts window interactions with cross-origin documents.
  # COEP: 'credentialless' enables cross-origin isolation while allowing external resources
  #       (images, fonts, CDNs) to load without requiring CORP headers.
  #
  def set_webcontainer_headers
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "credentialless"
  end
end
