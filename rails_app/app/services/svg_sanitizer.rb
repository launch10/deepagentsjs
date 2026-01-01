# frozen_string_literal: true

# SvgSanitizer removes potentially malicious content from SVG files using
# a whitelist approach with Nokogiri for proper XML parsing.
#
# SVGs can contain embedded JavaScript that executes when rendered in browsers,
# making them a potential XSS vector. This sanitizer uses a strict whitelist
# of allowed elements and attributes rather than trying to block dangerous ones.
#
# @example
#   sanitized_content = SvgSanitizer.sanitize(svg_string)
#
class SvgSanitizer
  # Whitelisted SVG elements that are safe to render (lowercase for comparison)
  # This list covers common SVG elements used for graphics rendering
  ALLOWED_ELEMENTS = Set.new(%w[
    svg
    g
    defs
    symbol
    use
    clippath
    mask
    pattern
    marker
    lineargradient
    radialgradient
    stop
    filter
    feblend
    fecolormatrix
    fecomponenttransfer
    fecomposite
    feconvolvematrix
    fediffuselighting
    fedisplacementmap
    fedistantlight
    fedropshadow
    feflood
    fefunca
    fefuncb
    fefuncg
    fefuncr
    fegaussianblur
    feimage
    femerge
    femergenode
    femorphology
    feoffset
    fepointlight
    fespecularlighting
    fespotlight
    fetile
    feturbulence
    rect
    circle
    ellipse
    line
    polyline
    polygon
    path
    text
    tspan
    textpath
    image
    a
    title
    desc
    metadata
    switch
    view
  ]).freeze

  # Whitelisted attributes that are safe for SVG elements (lowercase for comparison)
  # Excludes all event handlers and dangerous URL attributes
  ALLOWED_ATTRIBUTES = Set.new(%w[
    id
    class
    style
    transform
    x
    y
    width
    height
    rx
    ry
    cx
    cy
    r
    fx
    fy
    fr
    x1
    y1
    x2
    y2
    points
    d
    fill
    fill-opacity
    fill-rule
    stroke
    stroke-dasharray
    stroke-dashoffset
    stroke-linecap
    stroke-linejoin
    stroke-miterlimit
    stroke-opacity
    stroke-width
    opacity
    visibility
    display
    color
    color-interpolation
    color-interpolation-filters
    flood-color
    flood-opacity
    lighting-color
    stop-color
    stop-opacity
    clip-path
    clip-rule
    mask
    filter
    marker
    marker-start
    marker-mid
    marker-end
    viewbox
    preserveaspectratio
    xmlns
    version
    baseprofile
    gradientunits
    gradienttransform
    spreadmethod
    patternunits
    patterncontentunits
    patterntransform
    filterunits
    primitiveunits
    in
    in2
    result
    mode
    type
    values
    tablevalues
    slope
    intercept
    amplitude
    exponent
    offset
    k1
    k2
    k3
    k4
    operator
    order
    kernelmatrix
    divisor
    bias
    targetx
    targety
    edgemode
    kernelunitlength
    surfacescale
    diffuseconstant
    specularconstant
    specularexponent
    limitingconeangle
    azimuth
    elevation
    pointsatx
    pointsaty
    pointsatz
    stddeviation
    dx
    dy
    scale
    xchannelselector
    ychannelselector
    basefrequency
    numoctaves
    seed
    stitchtiles
    font-family
    font-size
    font-style
    font-weight
    font-variant
    font-stretch
    text-anchor
    text-decoration
    dominant-baseline
    alignment-baseline
    baseline-shift
    letter-spacing
    word-spacing
    writing-mode
    glyph-orientation-horizontal
    glyph-orientation-vertical
    direction
    unicode-bidi
    startoffset
    textlength
    lengthadjust
    method
    spacing
    rotate
    overflow
    clip
    enable-background
    vector-effect
    shape-rendering
    text-rendering
    image-rendering
    color-rendering
    pointer-events
    cursor
    src
  ]).freeze

  # Attributes that can contain URLs - these need special handling
  URL_ATTRIBUTES = Set.new(%w[
    href
    xlink:href
  ]).freeze

  class << self
    # Sanitize SVG content to remove XSS vectors
    #
    # @param content [String] Raw SVG content
    # @return [String] Sanitized SVG content
    def sanitize(content)
      return content if content.blank?

      # Parse the SVG as XML with recover option for malformed XML
      doc = Nokogiri::XML(content) do |config|
        config.nonet    # Prevent network access
        config.noent    # Do not substitute entities
        config.recover  # Recover from errors
      end

      # If we couldn't parse anything useful, return empty string for safety
      return "" if doc.root.nil?

      # Process all nodes in the document
      sanitize_node(doc.root)

      # Return the sanitized SVG as a string
      # Preserve XML declaration if present
      if content.include?("<?xml")
        doc.to_xml(save_with: Nokogiri::XML::Node::SaveOptions::AS_XML)
      else
        doc.root&.to_xml || ""
      end
    end

    private

    def sanitize_node(node)
      return if node.nil?

      # Handle element nodes
      if node.element?
        element_name = node.name.downcase

        # Remove disallowed elements entirely
        unless allowed_element?(element_name)
          node.remove
          return
        end

        # Sanitize attributes
        sanitize_attributes(node)
      end

      # Process children (make a copy of the list since we may remove nodes)
      node.children.to_a.each do |child|
        sanitize_node(child)
      end
    end

    def allowed_element?(element_name)
      ALLOWED_ELEMENTS.include?(element_name)
    end

    def sanitize_attributes(node)
      # Process all attribute nodes
      node.attribute_nodes.to_a.each do |attr|
        # Get the full attribute name including namespace prefix
        full_name = if attr.namespace && attr.namespace.prefix
          "#{attr.namespace.prefix}:#{attr.name}"
        else
          attr.name
        end

        attr_name_lower = attr.name.downcase
        full_name_lower = full_name.downcase

        # Check if it's an event handler (starts with "on")
        if attr_name_lower.start_with?("on")
          remove_attribute_safely(node, attr)
          next
        end

        # Check if it's a URL attribute (including xlink:href)
        if url_attribute?(attr_name_lower) || url_attribute?(full_name_lower)
          unless safe_url?(decode_url(attr.value.to_s.strip))
            remove_attribute_safely(node, attr)
          end
          next
        end

        # Check if it's an allowed attribute
        unless allowed_attribute?(attr_name_lower)
          remove_attribute_safely(node, attr)
        end
      end
    end

    def remove_attribute_safely(node, attr)
      # Handle namespaced attributes properly
      if attr.namespace
        node.remove_attribute(attr.name)
        # Also try the prefixed version
        if attr.namespace.prefix
          node.remove_attribute("#{attr.namespace.prefix}:#{attr.name}")
        end
      else
        node.remove_attribute(attr.name)
      end
    rescue StandardError
      # If removal fails, try to set it to empty
      attr.value = ""
    end

    def allowed_attribute?(attr_name)
      return true if ALLOWED_ATTRIBUTES.include?(attr_name)
      return true if URL_ATTRIBUTES.include?(attr_name)
      # Allow data-* attributes
      return true if attr_name.start_with?("data-")
      # Allow xml namespace declarations
      return true if attr_name.start_with?("xmlns")

      false
    end

    def url_attribute?(attr_name)
      URL_ATTRIBUTES.include?(attr_name)
    end

    def decode_url(url)
      # Decode HTML entities and URL encoding to catch obfuscation attempts
      decoded = url.dup

      # Decode HTML entities
      decoded = CGI.unescapeHTML(decoded)

      # Decode URL encoding (multiple passes to catch double encoding)
      3.times do
        previous = decoded
        begin
          decoded = CGI.unescape(decoded)
        rescue ArgumentError
          # Invalid encoding, keep as is
          break
        end
        break if decoded == previous
      end

      # Remove null bytes and whitespace that might be used for obfuscation
      decoded = decoded.gsub(/[\x00\s]+/, "")

      decoded.downcase
    end

    def safe_url?(decoded_url)
      # Allow fragment references (e.g., #someId)
      return true if decoded_url.start_with?("#")

      # Allow empty URLs
      return true if decoded_url.empty?

      # Allow relative URLs that don't contain dangerous protocols
      return true if decoded_url.match?(%r{\A[a-z0-9_\-./]+\z}i) && !decoded_url.include?(":")

      # Check for dangerous protocols
      return false if decoded_url.match?(/\Ajavascript:/i)
      return false if decoded_url.match?(/\Avbscript:/i)
      return false if decoded_url.match?(/\Adata:/i)

      # Allow http and https URLs
      return true if decoded_url.match?(%r{\Ahttps?://}i)

      # Block anything else with a protocol
      return false if decoded_url.include?(":")

      true
    end
  end
end
