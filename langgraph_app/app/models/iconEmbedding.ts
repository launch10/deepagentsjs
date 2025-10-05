import { BaseModel } from "./base";
import { iconEmbeddings } from "app/db";
import { iconEmbeddingSchema } from "@shared/types";

export class IconEmbeddingModel extends BaseModel<
  typeof iconEmbeddings, 
  typeof iconEmbeddingSchema
> {
    protected static table = iconEmbeddings;
    protected static schema = iconEmbeddingSchema;
}