# frozen_string_literal: true

# SvgSanitizer removes potentially malicious content from SVG files.
# SVGs can contain embedded JavaScript that executes when rendered in browsers,
# making them a potential XSS vector.
#
# This sanitizer:
# - Removes <script> tags and their contents
# - Removes event handler attributes (onclick, onload, onerror, etc.)
# - Removes javascript: URLs from href and xlink:href attributes
# - Removes data: URLs that could contain scripts
# - Preserves valid SVG structure and styling
#
# @example
#   sanitized_content = SvgSanitizer.sanitize(svg_string)
#
class SvgSanitizer
  # Event handler attributes that can execute JavaScript
  EVENT_HANDLERS = %w[
    onabort onactivate onbegin oncancel oncanplay oncanplaythrough onchange
    onclick onclose oncopy oncut ondblclick ondrag ondragend ondragenter
    ondragleave ondragover ondragstart ondrop ondurationchange onemptied
    onend onended onerror onfocus onfocusin onfocusout onhashchange oninput
    oninvalid onkeydown onkeypress onkeyup onload onloadeddata onloadedmetadata
    onloadstart onmessage onmousedown onmouseenter onmouseleave onmousemove
    onmouseout onmouseover onmouseup onmousewheel onoffline ononline onpagehide
    onpageshow onpaste onpause onplay onplaying onprogress onratechange onrepeat
    onreset onresize onscroll onseeked onseeking onselect onshow onstalled
    onstart onstorage onsubmit onsuspend ontimeupdate ontoggle ontouchcancel
    ontouchend ontouchmove ontouchstart onunload onvolumechange onwaiting onzoom
  ].freeze

  class << self
    # Sanitize SVG content to remove XSS vectors
    #
    # @param content [String] Raw SVG content
    # @return [String] Sanitized SVG content
    def sanitize(content)
      return content if content.blank?

      sanitized = content.dup

      # Remove script tags and their contents
      sanitized = remove_script_tags(sanitized)

      # Remove event handler attributes
      sanitized = remove_event_handlers(sanitized)

      # Remove javascript: and data: URLs
      sanitized = remove_dangerous_urls(sanitized)

      # Remove use of external entities that could load remote content
      remove_external_entities(sanitized)
    end

    private

    def remove_script_tags(content)
      # Remove <script>...</script> tags (including CDATA blocks)
      content.gsub(%r{<script[^>]*>.*?</script>}mi, "")
    end

    def remove_event_handlers(content)
      # Build pattern to match any event handler attribute
      # Matches: onclick="..." or onclick='...' or onclick=value
      # Uses lookbehind for tag context and handles attributes at start of attribute list
      pattern = /\s*(#{EVENT_HANDLERS.join("|")})\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i
      content.gsub(pattern, "")
    end

    def remove_dangerous_urls(content)
      # Remove javascript: URLs in href and xlink:href
      # Handle double-quoted and single-quoted attribute values separately
      # to avoid issues with nested quotes in the URL

      # Double-quoted href with javascript:
      content = content.gsub(/(\s(?:href|xlink:href)\s*=\s*")javascript:[^"]*(")/i, '\1\2')

      # Single-quoted href with javascript:
      content = content.gsub(/(\s(?:href|xlink:href)\s*=\s*')javascript:[^']*(')/i, '\1\2')

      # Remove data: URLs that might contain scripts (but allow safe data URLs for images)
      # Double-quoted
      content = content.gsub(/(\s(?:href|xlink:href)\s*=\s*")data:(?:text\/html|application\/javascript|text\/javascript)[^"]*(")/i, '\1\2')

      # Single-quoted
      content.gsub(/(\s(?:href|xlink:href)\s*=\s*')data:(?:text\/html|application\/javascript|text\/javascript)[^']*(')/i, '\1\2')
    end

    def remove_external_entities(content)
      # Remove potentially dangerous elements that can load external content
      # foreignObject can embed HTML which could contain scripts
      content = content.gsub(%r{<foreignObject[^>]*>.*?</foreignObject>}mi, "")

      # Remove set and animate elements that could trigger scripts
      content = content.gsub(%r{<set[^>]*\s+(?:onbegin|onend|onrepeat)\s*=[^>]*>.*?</set>}mi, "")
      content.gsub(%r{<animate[^>]*\s+(?:onbegin|onend|onrepeat)\s*=[^>]*>.*?</animate>}mi, "")
    end
  end
end
