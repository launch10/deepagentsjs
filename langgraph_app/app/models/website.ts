import { websiteSchema } from "@types";
import { BaseModel } from "./base";
import { websites } from "app/db";

export class WebsiteModel extends BaseModel<typeof websites, typeof websiteSchema> {
    protected static table = websites;
    protected static schema = websiteSchema;
}