import { ComponentTypeEnum, type FileSpecType } from "@types";
import { db, fileSpecifications } from "@db";

export type FileSpecRegistry = Map<ComponentTypeEnum, FileSpecType>;

const fileSpecs = await db.select().from(fileSpecifications).execute().catch((err) => {
    console.error("❌ Fatal Error: Could not fetch file specifications from the database.", err);
    process.exit(1);
});

const registry = new Map<ComponentTypeEnum, FileSpecType>();
fileSpecs.forEach((fileSpec: FileSpecType) => {
    registry.set(fileSpec.componentType, fileSpec);
});

export const fileSpecRegistry: FileSpecRegistry = registry;