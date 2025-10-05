import { BaseModel } from "./base";
import { fileSpecRegistry } from "@core";
import { componentOverviews } from "app/db";
import { componentOverviewSchema, Website } from "@types";
import { mapArray } from "@utils";
export class ComponentOverviewModel extends BaseModel<typeof componentOverviews, typeof componentOverviewSchema> {
  protected static table = componentOverviews;
  protected static schema = componentOverviewSchema;

  // When we plan a page, we need to ensure we have unique component names, so 
  // we're not encountering name collisions when we import the components
  public static async normalizePromptOutput(components: Website.Component.OverviewType[], pageId: string, websiteId: string): Promise<Website.Component.OverviewType[]> {
    const componentTypeCounts = this.countByComponentType(components);
    const componentTypes = mapArray(components, "componentType");

    let componentIdx = 0;
    return components.map((componentOverview) => {
      const componentType = componentOverview.componentType;
      const fileSpec = fileSpecRegistry.get(componentType);
      const count = componentTypeCounts.get(componentType) || 0;

      if (!fileSpec) {
        throw new Error(`File specification not found for section: ${componentType}`);
      }

      if (count > 1) {
        componentOverview.path = fileSpec.canonicalPath.replace(componentType, componentOverview.name);
      } else {
        componentOverview.path = fileSpec.canonicalPath;
        componentOverview.name = fileSpec.componentType;
      }
      componentOverview.sortOrder = componentIdx;
      componentOverview.pageId = pageId;
      componentOverview.websiteId = websiteId;
      componentOverview.fileSpecificationId = fileSpec.id;

      componentIdx++;
      return componentOverview;
    })
  }

  public static countByComponentType(components: Website.Component.OverviewType[]): Map<string, number> {
    const componentTypeCounts = new Map<string, number>();
    components.forEach((componentOverview) => {
      const componentType = componentOverview.componentType;
      const count = componentTypeCounts.get(componentType) || 0;
      componentTypeCounts.set(componentType, count + 1);
    });
    return componentTypeCounts;
  }
}