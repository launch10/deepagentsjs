import { fileSpecRegistry } from "@models/registry/fileSpecificationRegistry";
import { FileTypeEnum } from "@models/enums";

const sectionTypes = fileSpecRegistry.getAllByType(FileTypeEnum.Section).map((section) => {
  return `${section.subtype}: ${section.description}`;
}).join("\n");
export const whenToChooseEachSection = `
  If you are creating a new section, choose the section type that best matches the user's request:
  ${sectionTypes}
`;
