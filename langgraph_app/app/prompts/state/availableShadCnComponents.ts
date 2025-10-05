import { TemplateModel } from '@models';
import { renderPrompt, toXML } from '@prompts';

export const availableShadCnComponentsPrompt = async (): Promise<string> => {
  const template = await TemplateModel.getTemplate("default");
  const availableComponents = await template.availableShadCnComponents();

  return renderPrompt(toXML({
    values: availableComponents,
    tag: "available-shad-cn-components",
    itemTag: "component"
  }))
}