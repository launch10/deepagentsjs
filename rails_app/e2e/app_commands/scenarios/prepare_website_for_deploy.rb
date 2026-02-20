# Prepares a website so all LLM-heavy deploy tasks skip naturally.
#
# Usage: await appScenario('prepare_website_for_deploy', { website_id: 1 })
#
# This adds test data that satisfies skip conditions for:
#   - OptimizingSEO: index.html with 5+/7 SEO elements
#   - OptimizingPageForLLMs: public/llms.txt exists
#   - AddingAnalytics: already satisfied (CTA.tsx/Hero.tsx have LeadForm)
#
# Designed to run AFTER restoring `domain_step` snapshot.

opts = command_options || {}
website_id = (opts[:website_id] || opts["website_id"] || Website.first&.id || 1).to_i
website = Website.find(website_id)

# 1. Create index.html in website_files with full SEO meta tags
#    The SEO node reads from website_files (not template_files/code_files view).
#    countSEOElements checks for: title, meta description, og:title, og:description,
#    og:image, twitter:card, favicon — we include all 7.
seo_index_html = <<~HTML
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>TimeSyncPro - Smart Meeting Scheduling for Teams</title>
      <meta name="description" content="Stop the scheduling madness. TimeSyncPro helps teams coordinate meetings in seconds, not hours. Join 2,000+ teams." />
      <meta property="og:title" content="TimeSyncPro - Smart Meeting Scheduling" />
      <meta property="og:description" content="Coordinate meetings in seconds, not hours." />
      <meta property="og:image" content="https://example.com/og-image.png" />
      <meta property="og:url" content="https://test-site.launch10.site/" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="TimeSyncPro - Smart Meeting Scheduling" />
      <meta name="twitter:description" content="Coordinate meetings in seconds, not hours." />
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="canonical" href="https://test-site.launch10.site/" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" />
    </head>
    <body>
      <script>window.__BASENAME__ = '/' + (window.location.pathname.split('/')[1] || '');</script>
      <div id="root"></div>
      <script type="module" src="/src/main.tsx"></script>
    </body>
  </html>
HTML

wf = WebsiteFile.find_or_initialize_by(website_id: website.id, path: "index.html")
wf.content = seo_index_html
wf.save!

# 2. Create public/llms.txt in website_files
#    The LLMs node checks: llmsTxtExists(websiteId) via website_files table.
llms_txt = <<~TXT
  # TimeSyncPro
  > Smart meeting scheduling for distributed teams

  ## Key Information
  - Target Audience: Remote and hybrid teams
  - Value Proposition: Coordinate meetings in seconds, not hours

  ## About
  - [Homepage](https://test-site.launch10.site/)
TXT

wf = WebsiteFile.find_or_initialize_by(website_id: website.id, path: "public/llms.txt")
wf.content = llms_txt
wf.save!

logger.info "[prepare_website_for_deploy] Added SEO index.html + llms.txt for website #{website.id}"

{ status: "ok", website_id: website.id }
