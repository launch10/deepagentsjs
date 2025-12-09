import { ComponentTypeEnum, type FileSpecType } from "@types";
import { db, fileSpecifications } from "@db";

export type FileSpecRegistry = Map<ComponentTypeEnum, FileSpecType>;

const fileSpecs = await db
  .select()
  .from(fileSpecifications)
  .execute()
  .catch((err) => {
    console.error("❌ Fatal Error: Could not fetch file specifications from the database.", err);
    process.exit(1);
  });

const registry = new Map<ComponentTypeEnum, FileSpecType>();
// Annoying, but we can't easily alert the db about ComponentTypeEnum because
// we use postgres reflection. I suspect we may end up moving away from this stuff as we
// move towards the agentic system and away from hardcoded file specs.
fileSpecs.forEach((fileSpec) => {
  registry.set(fileSpec.componentType as ComponentTypeEnum, fileSpec as FileSpecType);
});

export const fileSpecRegistry: FileSpecRegistry = registry;
