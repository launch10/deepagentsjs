# == Schema Information
#
# Table name: code_files
#
#  content     :string
#  content_tsv :tsvector
#  embedding   :vector(1536)
#  path        :string
#  shasum      :string
#  source_type :text
#  created_at  :datetime
#  updated_at  :datetime
#  source_id   :bigint
#  website_id  :bigint
#

require 'rails_helper'

RSpec.describe CodeFile, type: :model do
  # Create test data
  let!(:account) { create(:account) }
  let!(:user) { create(:user) }
  let!(:template) { create(:template) }
  let!(:project) { create(:project, account: account) }
  let!(:website) { create(:website, name: "Test Site", project: project, account: account, template: template) }

  before do
    # Create template files
    template.files.create!(
      path: "src/components/Header.tsx",
      content: "import React, { useState } from 'react';\nexport default function Header() { return <div>Header</div>; }"
    )

    template.files.create!(
      path: "src/components/Footer.tsx",
      content: "import React from 'react';\nexport default function Footer() { return <footer>Footer content</footer>; }"
    )

    template.files.create!(
      path: "src/styles/main.css",
      content: ".header { background: blue; }\n.footer { background: gray; }"
    )

    # Create website files that override some template files
    website.website_files.create!(
      path: "src/components/Header.tsx",
      content: "import React, { useState, useEffect } from 'react';\nexport default function CustomHeader() { const [open, setOpen] = useState(false); return <header>Custom</header>; }"
    )

    website.website_files.create!(
      path: "src/utils/api.ts",
      content: "export async function fetchData() { return fetch('/api/data').then(res => res.json()); }"
    )

    # Ensure tsvector columns are populated (triggers may not fire in test transactions)
    ActiveRecord::Base.connection.execute(<<-SQL)
      UPDATE website_files 
      SET content_tsv = to_tsvector('english', 
        COALESCE(content, '') || ' ' || 
        COALESCE(regexp_replace(path, '[/.]', ' ', 'g'), '')
      )
      WHERE website_id = #{website.id};
      
      UPDATE template_files 
      SET content_tsv = to_tsvector('english', 
        COALESCE(content, '') || ' ' || 
        COALESCE(regexp_replace(path, '[/.]', ' ', 'g'), '')
      )
      WHERE template_id = #{template.id};
    SQL
  end

  describe "basic functionality" do
    it "returns merged files from website and template" do
      files = CodeFile.where(website_id: website.id)
      expect(files.count).to eq(4) # 2 template files + 2 website files (1 overrides template)

      paths = files.pluck(:path).sort
      expect(paths).to eq([
        "src/components/Footer.tsx",
        "src/components/Header.tsx",
        "src/styles/main.css",
        "src/utils/api.ts"
      ])
    end

    it "website files override template files with same path" do
      header_file = CodeFile.where(website_id: website.id, path: "src/components/Header.tsx").first
      expect(header_file.source_type).to eq("WebsiteFile")
      expect(header_file.content).to include("CustomHeader")
      expect(header_file.content).not_to include("function Header()")
    end

    it "is read-only" do
      file = CodeFile.where(website_id: website.id).first
      expect(file.readonly?).to be true
    end
  end

  describe "full-text search" do
    describe ".search" do
      it "finds files containing search terms" do
        results = CodeFile.where(website_id: website.id).search("useState")
        expect(results.count).to eq(1)
        expect(results.first.path).to eq("src/components/Header.tsx")
      end

      it "finds files with multiple search terms" do
        results = CodeFile.where(website_id: website.id).search("React import")
        expect(results.count).to eq(2)
        paths = results.pluck(:path).sort
        expect(paths).to include("src/components/Footer.tsx", "src/components/Header.tsx")
      end

      it "ranks results by relevance" do
        results = CodeFile.where(website_id: website.id).search_with_rank("useState useEffect")
        expect(results.first.path).to eq("src/components/Header.tsx")
        expect(results.first.rank).to be > 0
      end

      it "handles camelCase and snake_case" do
        results = CodeFile.where(website_id: website.id).search("fetchData")
        expect(results.count).to eq(1)
        expect(results.first.path).to eq("src/utils/api.ts")
      end
    end

    describe ".search_phrase" do
      it "finds exact phrases" do
        results = CodeFile.where(website_id: website.id).search_phrase("export default")
        expect(results.count).to eq(2) # Header and Footer components
      end

      it "requires words to be adjacent" do
        results = CodeFile.where(website_id: website.id).search_phrase("export async function")
        expect(results.count).to eq(1) # Only api.ts has "export async function"
        expect(results.first.path).to eq("src/utils/api.ts")
      end
    end

    describe ".search_boolean" do
      it "supports AND operator" do
        results = CodeFile.where(website_id: website.id).search_boolean("React & useState")
        expect(results.count).to eq(1)
        expect(results.first.path).to eq("src/components/Header.tsx")
      end

      it "supports OR operator" do
        results = CodeFile.where(website_id: website.id).search_boolean("useState | fetch")
        expect(results.count).to eq(2)
        paths = results.pluck(:path).sort
        expect(paths).to include("src/components/Header.tsx", "src/utils/api.ts")
      end

      it "supports NOT operator" do
        results = CodeFile.where(website_id: website.id).search_boolean("React & !useState")
        expect(results.count).to eq(1)
        expect(results.first.path).to eq("src/components/Footer.tsx")
      end
    end
  end

  describe "path search" do
    describe ".path_similar_to" do
      it "finds files with similar paths" do
        # Search for a path with a typo - "componets" instead of "components"
        results = CodeFile.where(website_id: website.id).path_similar_to("src/componets/Header.tsx", 0.5)
        expect(results.count).to be >= 1
        expect(results.first.path).to eq("src/components/Header.tsx")
      end

      it "returns similarity scores" do
        results = CodeFile.where(website_id: website.id).path_similar_to("src/components/Header.tsx", 0.3)
        expect(results.first.path_similarity).to eq(1.0)
      end
    end

    describe ".path_fuzzy" do
      it "finds files with fuzzy path matching" do
        # Use a path with a typo - "Headr" instead of "Header"
        results = CodeFile.where(website_id: website.id).path_fuzzy("src/components/Headr.tsx")
        # Both Header and Footer might match if very similar
        expect(results.count).to be >= 1
        paths = results.pluck(:path)
        expect(paths).to include("src/components/Header.tsx")
      end
    end
  end

  describe "filtering scopes" do
    describe "source_type filters" do
      it ".from_website returns only website files" do
        results = CodeFile.where(website_id: website.id).from_website
        expect(results.count).to eq(2)
        expect(results.pluck(:source_type).uniq).to eq(["WebsiteFile"])
      end

      it ".from_template returns only template files" do
        results = CodeFile.where(website_id: website.id).from_template
        expect(results.count).to eq(2)
        expect(results.pluck(:source_type).uniq).to eq(["TemplateFile"])
      end
    end

    describe "file type filters" do
      it ".typescript returns TypeScript files" do
        results = CodeFile.where(website_id: website.id).typescript
        expect(results.count).to eq(3)
        expect(results.pluck(:path)).to all(match(/\.(ts|tsx)$/))
      end

      it ".css returns CSS files" do
        results = CodeFile.where(website_id: website.id).css
        expect(results.count).to eq(1)
        expect(results.first.path).to eq("src/styles/main.css")
      end
    end
  end

  describe "search with highlighting" do
    it "highlights matching terms" do
      results = CodeFile.search_with_highlights("useState", start_sel: "**", stop_sel: "**")
        .where(website_id: website.id)
      expect(results.to_a.size).to eq(1)
      expect(results.first.highlighted_content).to include("**useState**")
    end

    it "provides context around matches" do
      results = CodeFile.search_with_context("useState", 5)
        .where(website_id: website.id)
      expect(results.to_a.size).to eq(1)
      expect(results.first.path).to eq("src/components/Header.tsx")
    end
  end

  describe "aggregate methods" do
    it ".count_matches_by_website counts matches per website" do
      # Create another website
      website2 = create(:website, name: "Site 2", project: project, account: account, template: template)
      website2.website_files.create!(
        path: "src/App.tsx",
        content: "import React, { useState } from 'react';"
      )

      # Update content_tsv for website2's files
      ActiveRecord::Base.connection.execute(<<-SQL)
        UPDATE website_files 
        SET content_tsv = to_tsvector('english', 
          COALESCE(content, '') || ' ' || 
          COALESCE(regexp_replace(path, '[/.]', ' ', 'g'), '')
        )
        WHERE website_id = #{website2.id};
      SQL

      counts = CodeFile.count_matches_by_website("useState")
      expect(counts[website.id]).to eq(1) # website has custom Header.tsx with useState
      expect(counts[website2.id]).to eq(2) # website2 has App.tsx + inherits Header.tsx from template (both have useState)
    end
  end

  describe "instance methods" do
    let(:file) { CodeFile.where(website_id: website.id).first }

    it "#website_file? returns true for website files" do
      website_file = CodeFile.where(website_id: website.id, source_type: "WebsiteFile").first
      expect(website_file).not_to be_nil
      expect(website_file.website_file?).to be true
      expect(website_file.template_file?).to be false
    end

    it "#template_file? returns true for template files" do
      template_file = CodeFile.where(website_id: website.id, source_type: "TemplateFile").first
      expect(template_file).not_to be_nil
      expect(template_file.template_file?).to be true
      expect(template_file.website_file?).to be false
    end

    it "#file_type returns the file extension" do
      ts_file = CodeFile.where(website_id: website.id, path: "src/utils/api.ts").first
      expect(ts_file.file_type).to eq("ts")

      css_file = CodeFile.where(website_id: website.id, path: "src/styles/main.css").first
      expect(css_file.file_type).to eq("css")
    end

    it "#language returns the programming language" do
      ts_file = CodeFile.where(website_id: website.id, path: "src/utils/api.ts").first
      expect(ts_file.language).to eq("typescript")

      css_file = CodeFile.where(website_id: website.id, path: "src/styles/main.css").first
      expect(css_file.language).to eq("css")
    end
  end

  describe "chaining scopes" do
    it "combines multiple scopes" do
      results = CodeFile.where(website_id: website.id)
        .typescript
        .from_website
        .search("useState")
      expect(results.count).to eq(1)
      expect(results.first.path).to eq("src/components/Header.tsx")
    end
  end
end
