import {
  type ComponentType,
  componentSchema,
} from "@types";
import { BaseModel } from "./base";
import { components } from "app/db";
import { FileSpecificationModel } from "./fileSpecification";
import { fileSpecRegistry } from "@core";
export class ComponentModel extends BaseModel<typeof components, typeof componentSchema> {
  protected static table = components;
  protected static schema = componentSchema;

  public static sort(components: ComponentType[], by: "pageOrder"): ComponentType[] {
    const fileSpecs = components.map(c => fileSpecRegistry.get(c.componentType));
    const sortedSpecs =  FileSpecificationModel.sort(fileSpecs, by);
    return sortedSpecs.map(spec => {
      const component = components.find(component => component.componentType === spec.componentType);
      if (!component) {
        throw new Error(`Component not found for file spec ${spec.componentType}`);
      }
      return component;
    });
  }
}