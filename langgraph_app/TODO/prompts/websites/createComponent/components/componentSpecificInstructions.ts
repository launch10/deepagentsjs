import { navPrompt } from "./nav";
import { footerPrompt } from "./footer";
import { Website } from "@types";

const ComponentTypeEnum = Website.Component.ComponentTypeEnum;
type ComponentTypeKey = keyof typeof ComponentTypeEnum;

export const componentSpecificInstructions = async ({ componentType }: { componentType: ComponentTypeKey }): Promise<string> => {
  switch (componentType) {
    case ComponentTypeEnum.Nav:
      return await navPrompt();
    case ComponentTypeEnum.Footer:
      return await footerPrompt();
    default:
      return ''
  }
}
