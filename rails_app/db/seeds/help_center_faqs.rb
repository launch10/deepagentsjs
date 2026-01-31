# frozen_string_literal: true

# Seeds FAQs from the Launch10 Ad Campaign Builder FAQ/Support Google Doc.
# Run: rails runner db/seeds/help_center_faqs.rb
# Or called from seeds.rb

module HelpCenterFaqSeeder
  FAQS = [
    # ── Create - Content: Ad Group Name ──
    {
      question: 'What is an "Ad Group"?',
      answer: <<~MD.strip,
        An Ad Group is a container inside your Google Ads campaign that holds:

        - A set of ads (your headlines and details)
        - A set of related keywords or search themes

        The Ad Group Name is for your internal organization. Customers never see it, but it matters because:

        - It helps you keep campaigns organized as you add more ads in the future.
        - It gives Launch10 and Google context about the theme of your ad, which can improve suggestions and relevance.
        - It often becomes the label you use later when looking at performance reports.

        Good Ad Group Names are short and specific, for example:

        - "Dog Walking – Brooklyn Heights"
        - "Emergency Plumbing – After Hours"
        - "Online Guitar Lessons – Intermediate"
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: "Is there a character limit for the Ad Group Name?",
      answer: <<~MD.strip,
        We follow Google's limits behind the scenes. Practically speaking:

        - Keep Ad Group Names short and scannable, ideally under 80 characters.
        - Use plain text without emojis or special characters, which can make reporting harder to read.
        - If you hit a limit, you will see a validation error and can shorten the name.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },

    # ── Create - Content: Headlines ──
    {
      question: "What are Headlines in my ad?",
      answer: <<~MD.strip,
        Headlines are short text snippets (up to 30 characters each) that appear as the bold, clickable part of your Google Search ad.

        In a live ad, Google usually shows 2–3 headlines at a time, side by side. With Responsive Search Ads, Google can test different combinations of the headlines you provide.

        On this page, you can:

        - Enter your own headlines
        - Edit AI-generated suggestions
        - Add extra headline options for Google to test
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: 'Why do I see "Select 3–15" for Headlines?',
      answer: <<~MD.strip,
        Google requires that a Responsive Search Ad has:

        - At least 3 active headlines
        - Up to 15 total headlines

        Launch10 lets you:

        - Add many headline ideas.
        - Choose which ones count as active (up to 15). Make sure to click the lock for headlines you'd like to keep.
        - Your campaign cannot be launched until at least 3 headlines are selected.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: "How many headlines should I actually use?",
      answer: <<~MD.strip,
        We recommend:

        - **Minimum:** 3 (required by Google)
        - **Better:** 5–8
        - **Maximum:** 15

        More high-quality options give Google more combinations to test, which can improve performance over time. However, avoid filling all 15 with only tiny variations. Aim for meaningful differences in message or angle.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: "How does Launch10's AI use my answers from earlier steps to suggest headlines?",
      answer: <<~MD.strip,
        We use everything you shared during the Brainstorm and Landing Page steps, including:

        - Your business type and services
        - Your ideal customer
        - Your tone and style preferences
        - Any offers, pricing, or location details

        Launch10 uses this context to generate headlines that:

        - Match your landing page content
        - Include relevant search phrases
        - Stay consistent with your page, so the ad and page feel like one seamless experience

        You can fully edit these suggestions. Once you change and lock a headline, we treat your version as the source of truth.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: 'What does "Refresh Suggestions" do for Headlines?',
      answer: <<~MD.strip,
        "Refresh Suggestions" will:

        - Ask the AI to generate a new set of headline ideas, based on your latest business info and page content.
        - Leave any existing headlines you have edited and locked in place.
        - Add the new suggestions below your current options (or replace only the ones that are still untouched).

        If you manually wrote or edited a headline and then locked it, that content will not be overwritten without your action.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: "Will Launch10 check if my headlines comply with Google Ads policies?",
      answer: <<~MD.strip,
        We do our best to keep suggestions within common Google Ads guidelines, but:

        - Google makes the final decision about ad approval.
        - If Google flags or disapproves a headline, you may need to adjust wording (for example, remove prohibited claims, sensitive content, or certain trademarks).

        If a headline is rejected, you can:

        - Edit it manually, or
        - Use "Refresh Suggestions" and pick an alternative.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },

    # ── Create - Content: Details (Descriptions) ──
    {
      question: 'What are "Details" in my ad?',
      answer: <<~MD.strip,
        Details represent the description lines of your Responsive Search Ad. Each detail:

        - Can be up to 90 characters.
        - Appears below your headlines in search results.
        - Gives you space to explain benefits, features, and calls to action.

        Google usually shows up to 2 description lines in a single ad impression.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: "How should I write effective Details?",
      answer: <<~MD.strip,
        A good description should:

        - **Expand on the headline** — Give more context, benefits, or proof.
        - **Address objections** — Mention trust signals (reviews, guarantees, certifications).
        - **Include a clear call to action** — "Book now," "Get a free quote," "Schedule your session."

        Examples:

        - "Personalized pet portraits, shot in-home or in studio. Book online in minutes."
        - "Licensed plumbers on call 24/7. Upfront pricing and fast emergency service."
        - "Try our software free for 14 days. No credit card required."

        Avoid misleading claims or language that could be seen as spammy.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: "What happens if my Detail text is longer than the limit?",
      answer: <<~MD.strip,
        Each Detail has a character counter. If you exceed the 90-character limit:

        - The counter will show that you are over the limit.
        - We prevent you from saving or moving forward until you shorten it.

        Shorten by removing filler words and focusing on one primary benefit and a call to action.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: "How does Launch10's AI create Details? Can I change them?",
      answer: <<~MD.strip,
        We use your earlier answers (business info, customers, offer, tone), your landing page copy, and your selected headlines to generate description options that:

        - Reinforce your main value proposition
        - Stay within character limits
        - Use clear calls to action

        You can fully edit each Detail. Your edits take priority over AI suggestions and will be used for the final ad.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },

    # ── Create - Content: General ──
    {
      question: "What if I am not sure what to write for my ad?",
      answer: <<~MD.strip,
        You have a few options:

        - **Start with AI suggestions** — Click "Refresh Suggestions" for both Headlines and Details, then lightly edit for accuracy and voice.
        - **Describe your offer in plain language** — Write how you would explain it to a friend. Keep sentences short and direct.
        - **Use a simple formula:**
          - Headline: Service or benefit plus who it is for.
          - Detail 1: What you do and why it is good.
          - Detail 2: Social proof or guarantee plus call to action.

        You can always revise later after seeing performance.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: "Will changing my content later affect my campaign?",
      answer: <<~MD.strip,
        Yes. When you edit Headlines or Details after launch:

        - We will sync the changes to Google Ads.
        - Google may need some time to re-learn which combinations perform best.
        - Your previous performance data stays in Google, but the "learning" phase may restart for new content.

        Small, focused changes are usually better than rewriting everything at once unless you are repositioning your offer.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: "What if I see an error message or cannot continue from the Content page?",
      answer: <<~MD.strip,
        Common reasons you may not be able to proceed:

        - Fewer than 3 selected headlines
        - Fewer than 2 selected details
        - A headline over 30 characters or a detail over 90 characters
        - Required fields left blank

        Check that you have enough selected options in each section, that character counters are within the limit, and that your Ad Group Name is filled in.

        If issues persist, you can remove any recently added content and try again, or ask the in-product assistant for help.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: 'How does the Content page relate to the "Highlights" tab?',
      answer: <<~MD.strip,
        On the **Content** tab you write the main ad text that appears in almost every impression.

        On the **Highlights** tab (next step), you add structured information such as features, service types, or callouts. These often map to Google ad extensions (now called "assets"), which can show in addition to your headlines and descriptions.

        You should complete the Content tab first, since this is the foundation of your ad.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: "How does the Ad Preview at the top work?",
      answer: <<~MD.strip,
        At the top of the page you'll see an Ad Preview card:

        - It updates as you edit your headlines and details.
        - It shows a sample combination of your content, not every possible version.
        - Different customers in Google Search may see different headline/description combinations than the one in the preview.

        The preview is meant to help you visualize the ad and check for typos, tone, and messaging — not to represent all variations.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },
    {
      question: "Can I bulk add headlines instead of typing them one by one?",
      answer: <<~MD.strip,
        Yes. On the Content page you can paste several headlines at once instead of typing them one by one.

        1. **Prepare your list:** Create your headlines in a text editor or spreadsheet. Put each headline on its own line and keep them under 30 characters.
        2. **Paste into the headline input:** Click in the main "Enter headline" field. Paste your list of headlines. We will detect line breaks and split them into separate headline rows.
        3. **Review and select:** Check that each new row looks correct and is within the character limit. Use "Select 3–15" to choose which ones are active for your ad.

        You can still edit or delete any individual headline after a bulk paste, and you can combine bulk-added headlines with AI-generated suggestions.
      MD
      category: "google_ads",
      subcategory: "Create - Content"
    },

    # ── Create - Highlights: Unique Features (Callout Assets) ──
    {
      question: 'What are "Unique Features" and where do they appear?',
      answer: <<~MD.strip,
        Unique Features are short phrases that highlight your key benefits. In Google Ads, these map to **Callout Assets**.

        Examples:

        - "Free consultation"
        - "Same-day appointments"
        - "Locally owned and operated"
        - "Studio or in-home sessions"

        When Google decides to show them, they appear as a line of short phrases below your main ad text. They are not clickable on their own, but they make your ad more prominent and add extra reasons for customers to choose you.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },
    {
      question: "How are Unique Features different from Headlines and Details?",
      answer: <<~MD.strip,
        - **Headlines** are the main clickable blue text in your ad.
        - **Details** (descriptions) are longer sentences that explain what you do.
        - **Unique Features** are very short, punchy phrases that stack on top of your existing ad text.

        Think of Unique Features as quick "bonus reasons" to choose you. They should not repeat entire sentences from your descriptions. Instead, they should call out standout perks.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },
    {
      question: 'What does "Select 2–10" mean for Unique Features?',
      answer: <<~MD.strip,
        We allow you to enter many Unique Feature options, but Google requires that only a subset be active at any time.

        - You must select at least 2 Unique Features on this page.
        - You can select up to 10 to give Google more options.
        - Your campaign cannot be launched until you have at least 2 selected Unique Features.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },
    {
      question: "How long can a Unique Feature be?",
      answer: <<~MD.strip,
        We let you write up to a short sentence with a **25 character limit** (you will see a character counter next to the input box).

        Best practice: Keep Unique Features brief so they can display cleanly on both desktop and mobile. Aim for a few words or up to one short line.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },
    {
      question: "How does Launch10's AI generate Unique Feature suggestions?",
      answer: <<~MD.strip,
        We use what you told us during Brainstorm (business, offer, audience), your Landing Page content, and your Headlines and Details. Using this context, the AI suggests Unique Features that:

        - Reflect your real offering
        - Emphasize benefits, trust, or convenience
        - Stay within reasonable length

        You can fully edit or delete any suggestion. Once you edit a feature, that edited version becomes the source of truth.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },
    {
      question: 'What does "Refresh Suggestions" do for Unique Features?',
      answer: <<~MD.strip,
        "Refresh Suggestions" will:

        - Ask Launch10 to generate new Unique Feature ideas based on your latest information.
        - Leave your existing edited features in place.
        - Either add new options to the list or replace only unlocked suggestions.

        Use it when you are not happy with the current ideas or when you changed your offer or positioning and want new wording.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },
    {
      question: 'What does the "lock" button on a Unique Feature do?',
      answer: <<~MD.strip,
        The lock button lets you protect a specific Unique Feature that you definitely want to use in your campaign.

        When you click the lock icon on a line:

        - That Unique Feature is included in your campaign, as long as it passes Google's policy checks.
        - It will not be replaced or removed if you click "Refresh Suggestions."
        - It is treated as selected/active, so it counts toward your required number of Unique Features.

        Use the lock when you have a line that is essential to your message and you do not want AI-generated suggestions to overwrite it.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },
    {
      question: "What happens if I leave Unique Features blank?",
      answer: <<~MD.strip,
        In many cases your ad can still run with just headlines and descriptions, but:

        - You will miss an opportunity to take up more space in search results.
        - Your ad may feel less compelling compared to competitors using callouts.

        We encourage you to add at least 2 Unique Features because they are a quick way to improve performance.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },

    # ── Create - Highlights: Product or Service Offerings (Structured Snippets) ──
    {
      question: 'What are "Product or Service Offerings" on the Highlights page?',
      answer: <<~MD.strip,
        This section represents **Structured Snippet Assets** in Google Ads.

        They show as a category label (such as "Services" or "Styles") followed by a list of values (the items you offer).

        Example: **Services:** In-Studio Portraits, Outdoor Sessions, Holiday Cards

        These snippets help customers quickly see the range of what you offer and make your ad look more complete and trustworthy.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },
    {
      question: "What is the Category dropdown for Product or Service Offerings?",
      answer: <<~MD.strip,
        The Category dropdown controls the label that appears before your list. Examples of categories:

        - Services
        - Types
        - Styles
        - Destinations
        - Brands
        - Courses
        - Neighborhoods

        You cannot free-type this label. Google provides a predefined list of categories and we map to those options. Choosing the right category helps Google understand your business and display your snippets appropriately.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },
    {
      question: "How do I choose the right Category for my offerings?",
      answer: <<~MD.strip,
        Pick the category that best describes how your list items fit together. For example, for "pet photography":

        - **Services** – if your items are types of services (studio sessions, outdoor sessions)
        - **Types** – if your items are portrait types (solo pets, pets with families, holiday sessions)
        - **Styles** – if items are artistic styles (classic, lifestyle, candid, black-and-white)

        If more than one category seems right, choose the one that would be clearest to a new customer who has never heard of you.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },
    {
      question: "How many Product or Service Offering values can I add?",
      answer: <<~MD.strip,
        Each value is a single offering that fits under your chosen category. On this page you will see a control that says "Select 3–10." That means:

        - You must select at least 3 values to activate.
        - You can select up to 10 for a Category.
        - You can add additional items using "Add Value."
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },
    {
      question: "How does Launch10 help with Product or Service Offerings?",
      answer: <<~MD.strip,
        We use the information from your Brainstorm answers, your landing page sections, and your selected headlines and details to suggest:

        - A suitable Category
        - A list of values that match your actual offerings

        You can change the Category from the dropdown, edit any value, and add or remove items as needed. Once edited, your version overrides our suggestion.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },

    # ── Create - Highlights: General ──
    {
      question: "Do Highlights always show with my ad?",
      answer: <<~MD.strip,
        No. Google decides when to show each asset based on:

        - The customer's device and context
        - The space available on the results page
        - The expected impact on performance

        Sometimes customers will see your ad with both Unique Features and Offerings, sometimes with only one type, and sometimes with just the core text. This is normal.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    },
    {
      question: "Why can't I move forward from the Highlights page?",
      answer: <<~MD.strip,
        Common reasons:

        - You have fewer than 2 selected Unique Features.
        - You have fewer than 3 selected Offerings in the Product or Service section.
        - A field is over the character limit or left completely blank.

        Check that you see "Selected" counts that meet the minimums in both sections, that each active item has valid text and no error messages, and that your Category is set for Product or Service Offerings.

        Once everything is valid and the minimum selections are met, you should be able to continue to the Plan step.
      MD
      category: "google_ads",
      subcategory: "Create - Highlights"
    }
  ].freeze

  def self.seed!
    puts "Seeding Help Center FAQs..."

    FAQS.each_with_index do |faq_data, index|
      FAQ.find_or_create_by!(slug: faq_data[:question].parameterize) do |faq|
        faq.question = faq_data[:question]
        faq.answer = faq_data[:answer]
        faq.category = faq_data[:category]
        faq.subcategory = faq_data[:subcategory]
        faq.position = index
        faq.published = true
      end
    end

    puts "  Created #{FAQ.count} FAQs"
  end
end

# Allow running directly: rails runner db/seeds/help_center_faqs.rb
HelpCenterFaqSeeder.seed! if $PROGRAM_NAME == __FILE__
