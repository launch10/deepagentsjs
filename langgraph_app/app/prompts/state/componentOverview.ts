import { type Website } from "@types"
import { renderPrompt, toXML } from '@prompts';
import { pick } from "@utils";

// E.g. 
// <component-overview>
//   <background-color>
//     primary
//   </background-color>
//   <component-id>
//     Hero
//   </component-id>
//   <context>
//     First section visitors see, must be compelling
//   </context>
//   <copy>
//     Transform your business today with our SaaS platform
//   </copy>
//   <name>
//     Hero Banner
//   </name>
//   <page>
//     IndexPage
//   </page>
//   <purpose>
//     Capture attention and establish credibility
//   </purpose>
//   <section-type>
//     Hero
//   </section-type>
//   <text-color>
//     Suggest a color that contrasts well with the background color, ideally a color from the global brand theme.
//   </text-color>
// </component-overview>
//
export const componentOverviewPrompt = async ({ overview }: { overview: Website.Component.OverviewType }): Promise<string> => {
  const selectedOverview = pick(overview, [ "backgroundColor", "name", "purpose", "context", "copy", ])
  const componentOverview = {
    ...selectedOverview,
    textColor: "Suggest a color that contrasts well with the background color, ideally a color from the global brand theme."
  }

  return renderPrompt(toXML({
    values: componentOverview,
    tag: "component-overview"
  }))
}