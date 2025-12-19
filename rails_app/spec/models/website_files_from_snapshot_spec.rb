require "rails_helper"

describe Website, "#files_from_snapshot" do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:template) { create(:template) }
  let(:website) { create(:website, account: account, project: project, template: template) }

  describe "basic behavior" do
    it "returns an empty collection when no snapshot exists" do
      expect(website.files_from_snapshot).to be_empty
    end

    it "returns an empty collection when snapshot_id is nil" do
      expect(website.files_from_snapshot(nil)).to be_empty
    end
  end

  describe "with website files only" do
    before do
      website.website_files.create!(path: "src/index.tsx", content: "export default function App() {}")
      website.website_files.create!(path: "src/styles.css", content: "body { margin: 0; }")
      website.snapshot
    end

    it "returns all website files from the snapshot" do
      files = website.files_from_snapshot
      expect(files.count).to eq(2)
      expect(files.map(&:path)).to contain_exactly("src/index.tsx", "src/styles.css")
    end

    it "returns files with correct content" do
      files = website.files_from_snapshot
      index_file = files.find { |f| f.path == "src/index.tsx" }
      expect(index_file.content).to eq("export default function App() {}")
    end

    it "returns files from a specific snapshot" do
      snapshot_id = website.latest_snapshot.snapshot_id

      website.website_files.first.update!(content: "// Updated content")
      website.snapshot

      old_files = website.files_from_snapshot(snapshot_id)
      expect(old_files.find { |f| f.path == "src/index.tsx" }.content).to eq("export default function App() {}")

      new_files = website.files_from_snapshot
      expect(new_files.find { |f| f.path == "src/index.tsx" }.content).to eq("// Updated content")
    end
  end

  describe "with template files only" do
    before do
      template.files.create!(path: "vite.config.ts", content: "export default {}")
      template.files.create!(path: "package.json", content: '{"name": "app"}')
      website.snapshot
    end

    it "returns template files from the snapshot" do
      files = website.files_from_snapshot
      expect(files.count).to eq(2)
      expect(files.map(&:path)).to contain_exactly("vite.config.ts", "package.json")
    end

    it "returns template files with correct content" do
      files = website.files_from_snapshot
      vite_file = files.find { |f| f.path == "vite.config.ts" }
      expect(vite_file.content).to eq("export default {}")
    end
  end

  describe "with both website and template files" do
    before do
      template.files.create!(path: "vite.config.ts", content: "// template vite config")
      template.files.create!(path: "package.json", content: '{"name": "template"}')
      template.files.create!(path: "src/main.tsx", content: "// template main")

      website.website_files.create!(path: "src/App.tsx", content: "// website App")
      website.website_files.create!(path: "src/main.tsx", content: "// website main override")
      website.snapshot
    end

    it "returns merged files from both template and website" do
      files = website.files_from_snapshot
      expect(files.count).to eq(4)
      expect(files.map(&:path)).to contain_exactly(
        "vite.config.ts",
        "package.json",
        "src/main.tsx",
        "src/App.tsx"
      )
    end

    it "website files override template files with the same path" do
      files = website.files_from_snapshot
      main_file = files.find { |f| f.path == "src/main.tsx" }
      expect(main_file.content).to eq("// website main override")
      expect(main_file.source_type).to eq("WebsiteFile")
    end

    it "preserves template files that are not overridden" do
      files = website.files_from_snapshot
      vite_file = files.find { |f| f.path == "vite.config.ts" }
      expect(vite_file.content).to eq("// template vite config")
      expect(vite_file.source_type).to eq("TemplateFile")
    end
  end

  describe "snapshot versioning" do
    let!(:template_file) do
      template.files.create!(path: "template.txt", content: "v1")
    end

    let!(:website_file) do
      website.website_files.create!(path: "website.txt", content: "v1")
    end

    let!(:snapshot_v1) do
      website.snapshot
      website.latest_snapshot.snapshot_id
    end

    it "returns correct files for each snapshot version" do
      website_file.update!(content: "v2")
      website.snapshot
      snapshot_v2 = website.latest_snapshot.snapshot_id

      website_file.update!(content: "v3")
      website.snapshot
      snapshot_v3 = website.latest_snapshot.snapshot_id

      expect(website.files_from_snapshot(snapshot_v1).find { |f| f.path == "website.txt" }.content).to eq("v1")
      expect(website.files_from_snapshot(snapshot_v2).find { |f| f.path == "website.txt" }.content).to eq("v2")
      expect(website.files_from_snapshot(snapshot_v3).find { |f| f.path == "website.txt" }.content).to eq("v3")
    end

    it "handles file additions across snapshots" do
      expect(website.files_from_snapshot(snapshot_v1).count).to eq(2)

      website.website_files.create!(path: "new_file.txt", content: "new")
      website.snapshot
      snapshot_v2 = website.latest_snapshot.snapshot_id

      expect(website.files_from_snapshot(snapshot_v1).count).to eq(2)
      expect(website.files_from_snapshot(snapshot_v2).count).to eq(3)
    end

    it "handles file deletions across snapshots" do
      expect(website.files_from_snapshot(snapshot_v1).count).to eq(2)

      website.website_files.find_by(path: "website.txt").destroy
      website.snapshot
      snapshot_v2 = website.latest_snapshot.snapshot_id

      expect(website.files_from_snapshot(snapshot_v1).count).to eq(2)
      expect(website.files_from_snapshot(snapshot_v2).count).to eq(1)
      expect(website.files_from_snapshot(snapshot_v2).map(&:path)).to eq(["template.txt"])
    end
  end

  describe "file attributes" do
    before do
      template.files.create!(path: "template.txt", content: "template content")
      website.website_files.create!(path: "website.txt", content: "website content")
      website.snapshot
    end

    it "includes path attribute" do
      files = website.files_from_snapshot
      expect(files.all? { |f| f.path.present? }).to be true
    end

    it "includes content attribute" do
      files = website.files_from_snapshot
      expect(files.all? { |f| f.content.present? }).to be true
    end

    it "includes source_type attribute" do
      files = website.files_from_snapshot
      expect(files.map(&:source_type)).to contain_exactly("TemplateFile", "WebsiteFile")
    end

    it "includes source_id attribute" do
      files = website.files_from_snapshot
      expect(files.all? { |f| f.source_id.present? }).to be true
    end

    it "includes website_id attribute" do
      files = website.files_from_snapshot
      expect(files.all? { |f| f.website_id == website.id }).to be true
    end
  end

  describe "edge cases" do
    it "handles websites with no template" do
      website_no_template = create(:website, account: account, project: project, template: template)
      website_no_template.website_files.create!(path: "index.html", content: "<html></html>")
      website_no_template.snapshot

      files = website_no_template.files_from_snapshot
      expect(files.count).to eq(1)
    end

    it "handles empty website files with populated template" do
      template.files.create!(path: "base.txt", content: "base")
      website.snapshot

      files = website.files_from_snapshot
      expect(files.count).to eq(1)
      expect(files.first.path).to eq("base.txt")
    end

    it "handles concurrent snapshots correctly" do
      website.website_files.create!(path: "file.txt", content: "original")
      website.snapshot
      snapshot1 = website.latest_snapshot.snapshot_id

      website2 = create(:website, account: account, project: project, template: template)
      website2.website_files.create!(path: "file.txt", content: "different")
      website2.snapshot

      expect(website.files_from_snapshot(snapshot1).first.content).to eq("original")
    end

    it "returns consistent results when called multiple times" do
      website.website_files.create!(path: "test.txt", content: "test")
      website.snapshot

      result1 = website.files_from_snapshot.to_a
      result2 = website.files_from_snapshot.to_a

      expect(result1.map(&:path)).to eq(result2.map(&:path))
      expect(result1.map(&:content)).to eq(result2.map(&:content))
    end
  end

  describe "querying capabilities" do
    before do
      template.files.create!(path: "src/utils.ts", content: "export const util = 1;")
      template.files.create!(path: "src/helpers.ts", content: "export const helper = 2;")
      website.website_files.create!(path: "src/app.ts", content: "import { util } from './utils';")
      website.website_files.create!(path: "src/index.ts", content: "import App from './app';")
      website.snapshot
    end

    it "supports filtering by path pattern" do
      files = website.files_from_snapshot.where("path LIKE ?", "src/%")
      expect(files.count).to eq(4)
    end

    it "supports ordering" do
      files = website.files_from_snapshot.order(path: :asc)
      expect(files.first.path).to eq("src/app.ts")
    end

    it "supports limit" do
      files = website.files_from_snapshot.limit(2)
      expect(files.count).to eq(2)
    end
  end

  describe "integration with deploys" do
    before do
      template.files.create!(path: "package.json", content: '{"version": "1.0.0"}')
      website.website_files.create!(path: "src/app.tsx", content: "// v1")
      website.snapshot
    end

    it "can be used to get files for a specific deploy" do
      deploy = website.deploys.create!(snapshot_id: website.latest_snapshot.snapshot_id)

      files = website.files_from_snapshot(deploy.snapshot_id)
      expect(files.count).to eq(2)
    end

    it "maintains file history across multiple deploys" do
      deploy1 = website.deploys.create!(snapshot_id: website.latest_snapshot.snapshot_id)

      website.website_files.first.update!(content: "// v2")
      website.snapshot
      deploy2 = website.deploys.create!(snapshot_id: website.latest_snapshot.snapshot_id)

      files_v1 = website.files_from_snapshot(deploy1.snapshot_id)
      files_v2 = website.files_from_snapshot(deploy2.snapshot_id)

      expect(files_v1.find { |f| f.path == "src/app.tsx" }.content).to eq("// v1")
      expect(files_v2.find { |f| f.path == "src/app.tsx" }.content).to eq("// v2")
    end
  end
end
