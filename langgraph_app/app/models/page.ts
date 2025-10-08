import { z } from "zod";
import {
  PageTypeEnum,
  Website,
  pageSchema,
} from "@types";
import { FileSpecificationModel } from "@models";
import { fileSpecRegistry } from "@core";
import { pages } from "app/db";
import { BaseModel } from "./base";
export class PageModel extends BaseModel<typeof pages, typeof pageSchema> {
  protected static table = pages;
  protected static schema = pageSchema;

  public static addPage(pages: Website.PageType[] | undefined, page: Website.PageType): Website.PageType[] {
    const existingPage = PageModel.findPage(pages, page.pageType);
    let pageToAdd;

    if (existingPage) {
      pageToAdd = {
        ...existingPage,
        ...page,
      }
    } else {
      pageToAdd = page;
    }

    const otherPages = pages?.filter(page => page.pageType !== pageToAdd.componentType);
    return [...(otherPages || []), pageToAdd];
  }

  public static findOrInitializePage(pages: Website.PageType[] | undefined, pageType: PageTypeEnum): Website.PageType {
    const page = PageModel.findPage(pages, pageType);
    if (page) {
      return page;
    } else {
      return PageModel.fromSubtype(pageType);
    }
  }

  public static findPage(pages: Website.PageType[] | undefined, pageType: PageTypeEnum): Website.PageType | undefined {
    if (!pages) {
        return undefined;
    }

    return pages?.find(page => page.pageType === componentType)
  }
    
  public static fromSubtype(pageType: PageTypeEnum): Website.PageType {
    const fileSpec = fileSpecRegistry.get(pageType);
    if (!fileSpec) {
        throw new Error(`File specification not found for section: ${pageType}`);
    } 
    const fileSpecInstance = new FileSpecificationModel(fileSpec)
    const filePath = fileSpecInstance.expectedComponentPath;

    const page: Website.PageType = {
        pageType: componentType,
        filePath,
        plan: undefined,
        components: [],
    }
    return page;
  }
}