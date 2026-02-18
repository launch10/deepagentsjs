require "rails_helper"

RSpec.describe "Prerendering", type: :integration, slow: true do
  let(:template_dir) { Rails.root.join("templates", "default") }
  let(:temp_dir) { Dir.mktmpdir("prerender_test") }

  after do
    FileUtils.rm_rf(temp_dir)
  end

  def copy_template_to_temp_dir
    # Copy all template files to the temp build directory
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

  def update_app_routes(route_line)
    app_path = File.join(temp_dir, "src", "App.tsx")
    content = File.read(app_path)
    content.sub!(
      '{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}',
      "#{route_line}\n      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL \"*\" ROUTE */}"
    )
    File.write(app_path, content)
  end

  describe "single-page site" do
    before do
      copy_template_to_temp_dir
      run_build!
    end

    it "prerenders content inside the root div" do
      index_html = read_dist_file("index.html")

      # Root div must NOT be empty
      expect(index_html).not_to include('<div id="root"></div>')

      # Root div must contain rendered HTML
      expect(index_html).to match(/<div id="root">.+<\/div>/m)
    end

    it "includes recognizable page content in the prerendered HTML" do
      index_html = read_dist_file("index.html")

      # The template IndexPage renders "Hello world" — that text should be in the static HTML
      expect(index_html).to include("Hello world")
    end

    it "preserves the script tags for client-side hydration" do
      index_html = read_dist_file("index.html")

      # The built JS bundle should still be referenced for hydration
      expect(index_html).to match(/src="[^"]*\.js"/)
    end

    it "writes a prerendered-routes.json manifest" do
      routes = JSON.parse(read_dist_file("prerendered-routes.json"))

      expect(routes).to eq(["/"])
    end

    it "uses a static basename of '/' (not runtime path detection)" do
      index_html = read_dist_file("index.html")

      # Must use static '/' — NOT the runtime window.location.pathname hack
      expect(index_html).to include("window.__BASENAME__ = '/';")
      expect(index_html).not_to include("window.location.pathname")
    end
  end

  describe "multi-page site" do
    before do
      copy_template_to_temp_dir

      # Add a PricingPage
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

      # Add an import and route for PricingPage to App.tsx
      app_path = File.join(temp_dir, "src", "App.tsx")
      content = File.read(app_path)

      # Add import
      content.sub!(
        'import { NotFound } from "./pages/NotFoundPage";',
        "import { NotFound } from \"./pages/NotFoundPage\";\nimport { PricingPage } from \"./pages/PricingPage\";"
      )

      # Add route
      content.sub!(
        '{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}',
        "<Route path=\"/pricing\" element={<PricingPage />} />\n      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL \"*\" ROUTE */}"
      )

      File.write(app_path, content)
      run_build!
    end

    it "prerenders the index page with content" do
      index_html = read_dist_file("index.html")

      expect(index_html).not_to include('<div id="root"></div>')
      expect(index_html).to include("Hello world")
    end

    it "creates a subdirectory with prerendered HTML for /pricing" do
      pricing_path = File.join(dist_path, "pricing", "index.html")

      expect(File.exist?(pricing_path)).to be true
    end

    it "prerenders the pricing page with its content" do
      pricing_html = read_dist_file("pricing/index.html")

      expect(pricing_html).not_to include('<div id="root"></div>')
      expect(pricing_html).to include("Pricing Plans")
      expect(pricing_html).to include("Choose the plan that works for you.")
    end

    it "includes both routes in prerendered-routes.json" do
      routes = JSON.parse(read_dist_file("prerendered-routes.json"))

      expect(routes).to contain_exactly("/", "/pricing")
    end

    it "pricing page has the same JS bundle for hydration" do
      index_html = read_dist_file("index.html")
      pricing_html = read_dist_file("pricing/index.html")

      # Extract JS bundle filename from both — should be identical
      index_js = index_html.match(/src="([^"]*\.js)"/)[1]
      pricing_js = pricing_html.match(/src="([^"]*\.js)"/)[1]

      expect(index_js).to eq(pricing_js)
    end
  end

  describe "PascalCase route naming convention" do
    before do
      copy_template_to_temp_dir

      # Add an AboutUsPage (PascalCase → kebab-case)
      add_page("AboutUsPage.tsx", <<~TSX)
        export function AboutUsPage() {
          return (
            <div>
              <h1>About Our Company</h1>
            </div>
          );
        }
      TSX

      app_path = File.join(temp_dir, "src", "App.tsx")
      content = File.read(app_path)
      content.sub!(
        'import { NotFound } from "./pages/NotFoundPage";',
        "import { NotFound } from \"./pages/NotFoundPage\";\nimport { AboutUsPage } from \"./pages/AboutUsPage\";"
      )
      content.sub!(
        '{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}',
        "<Route path=\"/about-us\" element={<AboutUsPage />} />\n      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL \"*\" ROUTE */}"
      )
      File.write(app_path, content)

      run_build!
    end

    it "creates /about-us/index.html from AboutUsPage.tsx" do
      about_path = File.join(dist_path, "about-us", "index.html")
      expect(File.exist?(about_path)).to be true

      about_html = read_dist_file("about-us/index.html")
      expect(about_html).to include("About Our Company")
    end
  end

  describe "NotFoundPage is excluded from prerendering" do
    before do
      copy_template_to_temp_dir
      run_build!
    end

    it "does not create a /not-found route" do
      routes = JSON.parse(read_dist_file("prerendered-routes.json"))

      expect(routes).not_to include("/not-found")
    end

    it "does not create a not-found directory" do
      expect(Dir.exist?(File.join(dist_path, "not-found"))).to be false
    end
  end

  describe "graceful degradation for SSR-incompatible components" do
    before do
      copy_template_to_temp_dir

      # Add a page that uses window directly (will fail during SSR)
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

    it "still prerenders the index page successfully" do
      index_html = read_dist_file("index.html")
      expect(index_html).to include("Hello world")
    end

    it "skips the broken route but includes it in discovered routes" do
      routes = JSON.parse(read_dist_file("prerendered-routes.json"))

      # The broken route should be skipped (not in the prerendered manifest)
      # Only successfully rendered routes appear
      expect(routes).to include("/")
      expect(routes).not_to include("/broken")
    end

    it "does not create a broken subdirectory" do
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
        double(full_url: "https://example.launch10.ai/")
      )
    end

    after do
      FileUtils.rm_rf(temp_dir)
    end

    it "includes all prerendered routes in sitemap" do
      # Write a prerendered-routes.json with multiple routes
      File.write(
        File.join(dist_dir, "prerendered-routes.json"),
        JSON.generate(["/", "/pricing", "/about-us"])
      )

      deploy.send(:generate_sitemap_xml!)

      sitemap = File.read(File.join(dist_dir, "sitemap.xml"))
      expect(sitemap).to include("<loc>https://example.launch10.ai/</loc>")
      expect(sitemap).to include("<loc>https://example.launch10.ai/pricing</loc>")
      expect(sitemap).to include("<loc>https://example.launch10.ai/about-us</loc>")
    end

    it "falls back to just / when prerendered-routes.json is missing" do
      deploy.send(:generate_sitemap_xml!)

      sitemap = File.read(File.join(dist_dir, "sitemap.xml"))
      expect(sitemap).to include("<loc>https://example.launch10.ai/</loc>")
      expect(sitemap).not_to include("/pricing")
    end

    it "includes lastmod timestamps" do
      deploy.send(:generate_sitemap_xml!)

      sitemap = File.read(File.join(dist_dir, "sitemap.xml"))
      expect(sitemap).to include("<lastmod>#{website.updated_at.strftime('%Y-%m-%d')}</lastmod>")
    end

    it "writes sitemap to dist/ directory (not public/)" do
      deploy.send(:generate_sitemap_xml!)

      expect(File.exist?(File.join(dist_dir, "sitemap.xml"))).to be true
      expect(File.exist?(File.join(temp_dir, "public", "sitemap.xml"))).to be false
    end
  end
end
