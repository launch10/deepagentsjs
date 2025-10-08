import { 
  structuredOutputPrompt,
  renderPrompt,
  type PromptMetadata, 
} from "@prompts";
import { Website } from "@types";
import type { BaseMessage } from '@langchain/core/messages';

export interface PlanWebsitePromptProps {
  userRequest: BaseMessage;
}

export const planWebsitePrompt = async({ userRequest }: PlanWebsitePromptProps): Promise<string> => {
  if (!userRequest) {

    throw new Error('userRequest is required');
  }
  const schema = Website.Plan.contentStrategySchema;
  const userInput = userRequest.content;
  const formatInstructions = await structuredOutputPrompt({ schema })

  return renderPrompt(`
    <task>
        Generate Emotionally Resonant Copy for an Entire Landing Page
    </task>

    <user-request>
        ${userInput}
    </user-request>

    <tone>
        Tone: Identify tone desired by user
      </tone>

    <instructions>
      Your goal is to BRAINSTORM emotionally resonant and high-converting copy for the **entire landing page**, treating it as a single narrative flow. Use the 8-step emotional copywriting playbook below as a guide to structure your thinking and generate the components of the copy. The final output should be a cohesive piece of landing page text.

      As in line with our brainstorm, your outputs are free-flowing and expansive. At the end you will consolidate down to a single, cohesive piece of copy.

      **The 11-Step Emotional Copywriting Playbook (Apply to the WHOLE PAGE):**

      ### Step 1. Pinpoint the Emotional Core: User's business may be targeting several emotional cores!

      - **Identity:** Am I selling customers a better version of themselves?
      - **Belonging:** Am I leveraging their fear of missing out or need for acceptance?
      - **Relief:** Am I solving a critical pain or frustration?
      - **Aspiration:** Am I speaking to dreams, goals, or hopes?
      - **Security:** Am I alleviating anxiety, worry, or uncertainty?

      **Key Question:** _"What deep emotional desire or fear am I primarily addressing?"_

      Example:
      - User input was: "Launch10 — A tool to find profitable niches to launch validated busienss ideas"
      - You write an expansive paragraph detailing the emotional core of the product:
        - "Relief: Validating a business idea takes weeks or month before you even start building anything. What if you could validate dozens of business ideas at once and pick the best one?"
        - "Belonging: Identify hot ideas before the rest of the market does."
        - "Aspiration: Build a business idea that will make you rich."
        - "Security: **The critical pain: What if I launch and nobody buys? Launch to validated demand"

      ### Step 2: Attention-Grabber (Headline/Hero Section)

      Immediately make it personal and emotional:

      - **Identity/Aspiration:** “Finally Become the Person Who [Desired Outcome]”
      - **Belonging:** “Don’t Be the Only One Left Behind When [Event or Trend Occurs]”
      - **Relief/Security:** “Stop [Painful Experience] Forever” or “Never Again Worry About [Pain Point]”

      **Template:**
      “[Powerful emotional statement] + [Your product as the solution]”

      Example Output:
      "What if I launch and ~~no one buys?~~ It changes my life?

      Imagine an image of a phone with alerts:

      - You have 2 new niches to explore
      - Under the Radar: 10 Hot Niches Are Flying UTR
      - Keep Building: Launch your next painted door test"

      ### Step 3: Empathy & Problem Statement (Subheadline/Intro Copy)

      Reflect the audience's experience vividly:

      - **Key Question:** _"How exactly does my customer describe their problem or aspiration in their own words?"_
      - **Technique:** Mirror language. Use exact phrases customers say about their pain points or dreams.

      **Example Template:**
      “Are you tired of [specific frustration or disappointment]? We’ve felt it too, and we found a solution.”

      Example Output:
      - So AI tools can help you build an app in days… but what should you build?
      - What if I launch and no one buys?
      - What if I have too many competitors?
      - Hasn’t every idea been done before?
      - What are people even searching for? What do they want?
      - I don’t even know where to start.

      ### Step 4: Emotional Bridge (Transition Section)

      Shift from empathy to solution by bridging emotions:

      - **Key Question:** _"How does my solution change how my customers feel about themselves or their situation?"_
      - **Technique:** Contrast Before/After emotions clearly and vividly.

      **Template:**
      “Imagine moving from [negative emotion or state] to finally experiencing [positive emotion or ideal state].”

      Example output:
      "The good news is: the internet is packed with valuable information… if you know where to look. When it comes to validating business ideas:

      - Hot takes > nothing
      - How you spend your attention > hot takes
      - How you spend your money >>>> how you spend your attention

      We aggregate the best data sources (ProductHunt, AHrefs, AppSumo, SEMRush, Reddit, Google, etc) into a single stream of information in order to identify new hot business ideas before they go viral. 

      You don’t need to do the digging. Get validated business ideas at your finger tips."

      ### Step 5: Product Reveal (Solution Section)

      Clearly position your solution as the emotional payoff:

      - **Key Question:** _"How specifically does my product enable this emotional transformation?"_
      - **Technique:** Emotional anchoring.

      Example output:
      "Launch10 is specifically designed to identify new hot subcommunities who are actually willing to pay to solve a problem. Tell us what businesses you’d actually be good at making, and we’ll find you validated business ideas that no one else is on top of. Or your money back."

      **Template:**
      “Our [product name] is specifically designed to [action verb related to emotional payoff], so you can [desired emotional outcome].”

      ### Step 6: Social Proof (Belonging/Validation Section)

      Use testimonials and case studies strategically:

      - **Identity/Aspiration:** Showcase transformations, emphasize “just like you” narratives.
      - **Belonging:** Highlight community and popularity (“Join thousands of others”)
      - **Security/Relief:** Emphasize reliability and dependability (“Trusted by over X satisfied users”)

      Example outputs:
      1. "Before we launched Launch10, *we used it to test over 200 business ideas,* and successfully launch a 2-person business for $1M ARR. 

      Then we said *fuck it*: let’s share Launch10."

      2. "We've helped solo founders from Apple, Github, Twitter, Linkedin, and Meta...

      Launch10 Users:
      $3.4M+ MRR Generated

      Success Rate:
      78% Profitable Launches

      Niche Database:
      14,782 Validated Opportunities"

      **Key Question:** _"What proof most resonates emotionally with my core audience?"_

      ### Step 7: Urgency & Scarcity (Closing Section)

      Invoke immediate action through fear of loss or missing out:

      - **Belonging/Identity:** “Limited spots—be one of the few who…”
      - **Relief/Security:** “Act now to finally end your struggle with…”

      **Template:**
      “Don’t miss your chance—[scarcity-driven CTA emphasizing emotional cost of inaction].”

      Example output:
      "SOLD OUT

      Launch10 can’t accept too many customers… or our customers won’t actually get the edge they’re paying for. Add your name to our waitlist for the next time we’re accepting new friends."

      ### Step 8: Call to Action (CTA)

      Make your CTA emotionally congruent with previous sections:

      - **Key Question:** _"Does my CTA align emotionally with the copy that precedes it?"_
      - **Technique:** Reinforce the emotional promise rather than focusing purely on functionality.

      **Template:**
      “Get [positive emotional outcome] Today” or “Yes, I Want to Stop [negative feeling]”

      Example output: "Show me validated business ideas!"

      **Step 9: Page Mood**

      To help the user create a landing page that resonates with their audience, suggest a mood or feeling that the page should evoke (e.g., "modern, professional, and trustworthy").

      Here are some helpful examples to get you started:

      1. Focusing on Trust & Security:
      A) "Like a firm handshake from a trusted expert." (Evokes: Reliability, competence, professionalism, reassurance)
      B) "The feeling of a secure vault or a well-built fortress." (Evokes: Security, strength, protection, dependability, robust)
      C) "Clear, calm waters – showing depth but easy to navigate." (Evokes: Transparency, clarity, ease of use, trustworthiness)
      D) "An established library or a seasoned craftsman's workshop." (Evokes: Knowledge, experience, authority, reliability, meticulousness)
      2. Focusing on Innovation & Excitement:
      A) "The buzz of a launch event – anticipation and cutting-edge energy." (Evokes: Excitement, newness, innovation, forward-thinking, dynamism)
      B) "Looking through a telescope at a newly discovered galaxy." (Evokes: Wonder, possibility, exploration, groundbreaking, future-focused)
      C) "A perfectly tuned sports car ready to accelerate." (Evokes: Speed, performance, power, precision, responsiveness)
      D) "A vibrant, bustling innovation lab." (Evokes: Creativity, energy, collaboration, progress, intelligence)
      3. Focusing on Simplicity & Ease:
      A) "A breath of fresh air on a clear day – effortless and refreshing." (Evokes: Simplicity, ease of use, clarity, relief, cleanliness)
      B) "The satisfaction of a perfectly organized workspace." (Evokes: Order, efficiency, control, calm, productivity)
      C) "A gentle, guiding hand leading you through a simple process." (Evokes: Helpfulness, support, intuitiveness, user-friendliness)
      D) "Minimalist Scandinavian design – functional, clean, and beautiful." (Evokes: Elegance, simplicity, whitespace, focus, thoughtful design)
      4. Focusing on Premium & Exclusivity:
      A) "Entering a private club or an exclusive art gallery opening." (Evokes: Exclusivity, luxury, sophistication, aspiration, quality)
      B) "The feel of fine craftsmanship – attention to detail and quality materials." (Evokes: Premium, high-quality, durability, artistry, value)
      C) "A bespoke suit fitting – tailored perfectly to your needs." (Evokes: Personalization, high-touch service, precision, importance)
      5. Focusing on Playfulness & Creativity:
      A) "A vibrant playground or a box of colorful building blocks." (Evokes: Fun, creativity, possibility, engagement, energy)
      B) "A quirky, independent coffee shop with unique character." (Evokes: Personality, approachability, warmth, community, uniqueness)
      C) "The feeling of brainstorming with imaginative colleagues." (Evokes: Collaboration, ideas, energy, free-flowing creativity)

      **Step 10: Visual Evocation**

      Help the designer visualize the landing page by suggesting a mood or feeling that the page should evoke (e.g., "grid layouts, sharp lines, clear hierarchy, ample whitespace, monochrome or limited theme with accent color, precise typography").

      1. Focusing on Cleanliness, Order & Clarity:
      A) "Visually evokes a meticulously organized architect's blueprint." (Suggests: Grid layouts, sharp lines, clear hierarchy, ample whitespace, monochrome or limited theme with accent color, precise typography.)
      B) "Like looking through crystal clear water to a smooth pebble bed." (Suggests: Transparency effects, subtle gradients, soft focus elements contrasting with sharp foreground, clean layout, perhaps cool or neutral tones.)
      C) "The visual calm of a minimalist Japanese Zen garden." (Suggests: Extreme whitespace, natural textures (subtle), asymmetrical balance, focus on a single striking element, muted/natural theme.)
      D) "Feels like a high-end, well-lit science laboratory." (Suggests: Clean lines, metallic or glass textures, bright illumination, precise iconography, possibly blue/white/grey theme, data visualizations.)
      2. Focusing on Energy, Dynamism & Modernity:
      A) "Visually akin to abstract light trails in a bustling city at night." (Suggests: Dark mode, vibrant neon accents, gradients, perhaps subtle motion/animation, dynamic angles or asymmetric layouts.)
      B) "The visual energy of a dynamic data visualization dashboard in motion." (Suggests: Bold charts/graphs as key visuals, strong color contrasts, clear information hierarchy, potentially grid-based but with active elements.)
      C) "Like a vibrant splash page from a cutting-edge tech magazine." (Suggests: Bold typography, potentially overlapping elements, strong photographic visuals (product or people), confident color use, modern sans-serif fonts.)
      D) "Visually evokes interconnected nodes in a glowing neural network." (Suggests: Lines connecting elements, possibly particle effects or subtle background animations, tech-focused blues/purples/greens, focus on connection and flow.)
      3. Focusing on Warmth, Approachability & Nature:
      A) "Like flipping through a beautifully illustrated children's storybook." (Suggests: Soft edges, textured backgrounds, character illustrations or friendly icons, warmer color theme, rounded typography.)
      B) "Visually evokes a cozy reading nook with warm, soft lighting." (Suggests: Warmer, muted tones (creams, browns, oranges), soft shadows, perhaps textures like paper or wood, comfortable and inviting layout.)
    C) "Like a sun-drenched photograph of a natural landscape." (Suggests: Prominent, high-quality nature imagery, theme derived from nature (greens, blues, earth tones), organic shapes or layouts, emphasis on light.)
    D) "Feels like a handcrafted object made from natural materials." (Suggests: Textures (wood, paper, fabric), slightly irregular or organic shapes, earthy theme, potentially serif or script fonts for warmth, focus on tactile quality.)
    4. Focusing on Luxury, Sophistication & Elegance:
    A) "Visually resembles the layout of a luxury watch advertisement." (Suggests: Dark, sophisticated theme (blacks, golds, deep jewel tones), high-contrast lighting on visuals, elegant serif fonts, ample negative space, focus on a single hero product/image.)
    B) "Like the interior of a modern, high-fashion boutique." (Suggests: Minimalist but bold, strong lines, potentially large-scale typography, high-quality photography (people or product), geometric precision, perhaps a monochrome theme with a single striking accent.)
    C) "Visually evokes embossed lettering on heavy, premium cardstock." (Suggests: Subtle textures, shadows suggesting depth (like letterpress), sophisticated color theme, elegant typography, potentially metallic accents.)
    D) "Feels like a cinematic establishing shot with dramatic lighting." (Suggests: Strong contrast, deep shadows, focused lighting on key elements, perhaps a full-bleed background image/video, creating a sense of mood and importance.)
    ---

    **STEP 11: Synthesize Landing Page Copy**

    Take all of the generated copy, and synthesize it into a single, cohesive piece of copy that will be used to generate the landing page.
  </instructions>

  ${formatInstructions}
  `);
}

planWebsitePrompt.promptMetadata = {
    name: 'Plan Website',
    category: 'Code Generation',
    description: 'Plans a React component with design guidelines',
    examples: []
} as PromptMetadata;