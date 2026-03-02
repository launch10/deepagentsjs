require "rails_helper"

RSpec.describe "Prerendering", type: :integration, slow: true do
  let(:template_dir) { Rails.root.join("templates", "default") }
  let(:temp_dir) { Dir.mktmpdir("prerender_test") }

  after do
    FileUtils.rm_rf(temp_dir)
  end

  def copy_template_to_temp_dir
    FileUtils.cp_r("#{template_dir}/.", temp_dir)
  end

  def run_build!
    install_ok = system("pnpm install --ignore-workspace", chdir: temp_dir, out: File::NULL, err: File::NULL)
    raise "pnpm install failed" unless install_ok

    build_ok = system("pnpm run build", chdir: temp_dir, out: File::NULL, err: File::NULL)
    raise "pnpm build failed" unless build_ok
  end

  def dist_path
    File.join(temp_dir, "dist")
  end

  def read_dist_file(relative_path)
    File.read(File.join(dist_path, relative_path))
  end

  def add_page(filename, content)
    pages_dir = File.join(temp_dir, "src", "pages")
    FileUtils.mkdir_p(pages_dir)
    File.write(File.join(pages_dir, filename), content)
  end

  describe "single-page site" do
    before do
      copy_template_to_temp_dir
      run_build!
    end

    it "prerenders static HTML with content, hydration scripts, manifest, and excludes NotFound" do
      index_html = read_dist_file("index.html")

      # Prerendered content inside root div
      expect(index_html).not_to include('<div id="root"></div>')
      expect(index_html).to match(/<div id="root">.+<\/div>/m)
      expect(index_html).to include("Hello world")

      # Hydration script tags preserved
      expect(index_html).to match(/src="[^"]*\.js"/)

      # Static basename (not runtime path detection)
      expect(index_html).to include("window.__BASENAME__ = '/';")
      expect(index_html).not_to include("window.location.pathname")

      # Manifest written, NotFound excluded
      routes = JSON.parse(read_dist_file("prerendered-routes.json"))
      expect(routes).to eq(["/"])
      expect(routes).not_to include("/not-found")
      expect(Dir.exist?(File.join(dist_path, "not-found"))).to be false
    end
  end

  describe "multi-page site" do
    before do
      copy_template_to_temp_dir

      add_page("PricingPage.tsx", <<~TSX)
        export function PricingPage() {
          return (
            <div>
              <h1>Pricing Plans</h1>
              <p>Choose the plan that works for you.</p>
            </div>
          );
        }
      TSX

      app_path = File.join(temp_dir, "src", "App.tsx")
      content = File.read(app_path)

      content.sub!(
        'import { NotFound } from "./pages/NotFoundPage";',
        "import { NotFound } from \"./pages/NotFoundPage\";\nimport { PricingPage } from \"./pages/PricingPage\";"
      )

      content.sub!(
        '{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}',
        "<Route path=\"/pricing\" element={<PricingPage />} />\n      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL \"*\" ROUTE */}"
      )

      File.write(app_path, content)
      run_build!
    end

    it "prerenders all routes into subdirectories with shared hydration bundle" do
      # Index page prerendered
      index_html = read_dist_file("index.html")
      expect(index_html).not_to include('<div id="root"></div>')
      expect(index_html).to include("Hello world")

      # Pricing page prerendered into subdirectory
      pricing_html = read_dist_file("pricing/index.html")
      expect(pricing_html).not_to include('<div id="root"></div>')
      expect(pricing_html).to include("Pricing Plans")

      # Both routes in manifest
      routes = JSON.parse(read_dist_file("prerendered-routes.json"))
      expect(routes).to contain_exactly("/", "/pricing")

      # Same JS bundle for hydration
      index_js = index_html.match(/src="([^"]*\.js)"/)[1]
      pricing_js = pricing_html.match(/src="([^"]*\.js)"/)[1]
      expect(index_js).to eq(pricing_js)
    end
  end

  describe "graceful degradation for SSR-incompatible components" do
    before do
      copy_template_to_temp_dir

      add_page("BrokenPage.tsx", <<~TSX)
        export function BrokenPage() {
          const width = window.innerWidth;
          return <div>Width: {width}</div>;
        }
      TSX

      app_path = File.join(temp_dir, "src", "App.tsx")
      content = File.read(app_path)
      content.sub!(
        'import { NotFound } from "./pages/NotFoundPage";',
        "import { NotFound } from \"./pages/NotFoundPage\";\nimport { BrokenPage } from \"./pages/BrokenPage\";"
      )
      content.sub!(
        '{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}',
        "<Route path=\"/broken\" element={<BrokenPage />} />\n      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL \"*\" ROUTE */}"
      )
      File.write(app_path, content)

      run_build!
    end

    it "skips broken routes without crashing the build" do
      # Index still works
      index_html = read_dist_file("index.html")
      expect(index_html).to include("Hello world")

      # Broken route excluded from manifest and filesystem
      routes = JSON.parse(read_dist_file("prerendered-routes.json"))
      expect(routes).to include("/")
      expect(routes).not_to include("/broken")
      expect(Dir.exist?(File.join(dist_path, "broken"))).to be false
    end
  end
end

RSpec.describe "Buildable sitemap with prerendered routes", type: :integration do
  include WebsiteFileHelpers

  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create_website_with_files(account: account, project: project, files: minimal_website_files) }
  let(:deploy) { website.deploys.create! }

  describe "#generate_sitemap_xml!" do
    let(:temp_dir) { Dir.mktmpdir("sitemap_test") }
    let(:dist_dir) { File.join(temp_dir, "dist") }

    before do
      FileUtils.mkdir_p(dist_dir)
      allow(deploy).to receive(:temp_dir).and_return(temp_dir)
      allow(website).to receive(:website_url).and_return(
        double(domain_string: "example.launch10.com", path: "/")
      )
    end

    after do
      FileUtils.rm_rf(temp_dir)
    end

    it "includes all prerendered routes in sitemap" do
      File.write(
        File.join(dist_dir, "prerendered-routes.json"),
        JSON.generate(["/", "/pricing", "/about-us"])
      )

      deploy.send(:generate_sitemap_xml!)

      sitemap = File.read(File.join(dist_dir, "sitemap.xml"))
      expect(sitemap).to include("<loc>https://example.launch10.com/</loc>")
      expect(sitemap).to include("<loc>https://example.launch10.com/pricing</loc>")
      expect(sitemap).to include("<loc>https://example.launch10.com/about-us</loc>")
    end

    it "falls back to just / when prerendered-routes.json is missing" do
      deploy.send(:generate_sitemap_xml!)

      sitemap = File.read(File.join(dist_dir, "sitemap.xml"))
      expect(sitemap).to include("<loc>https://example.launch10.com/</loc>")
      expect(sitemap).not_to include("/pricing")
    end

    it "includes lastmod timestamps" do
      deploy.send(:generate_sitemap_xml!)

      sitemap = File.read(File.join(dist_dir, "sitemap.xml"))
      expect(sitemap).to include("<lastmod>#{website.updated_at.strftime("%Y-%m-%d")}</lastmod>")
    end

    it "writes sitemap to dist/ directory (not public/)" do
      deploy.send(:generate_sitemap_xml!)

      expect(File.exist?(File.join(dist_dir, "sitemap.xml"))).to be true
      expect(File.exist?(File.join(temp_dir, "public", "sitemap.xml"))).to be false
    end
  end
end
