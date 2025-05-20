import { type FileSpecification } from "../fileSpecification";
import { FileTypeEnum,
         LanguageEnum,
         StyleTypeEnum
        } from "../enums";
import { indexCssPrompt } from "./style/indexCss";
import { tailwindConfigPrompt } from "./style/tailwindConfig";

export const styleRegistry: Record<string, FileSpecification> = {
    "Style:IndexCss": {
        id: "index-css",
        canonicalPath: "src/index.css",
        filetype: FileTypeEnum.Style,
        subtype: StyleTypeEnum.IndexCss,
        generationPrompt: indexCssPrompt,
        language: LanguageEnum.CSS
    },
    "Style:AppCss": {
        id: "app-css",
        canonicalPath: "src/app.css",
        filetype: FileTypeEnum.Style,
        subtype: StyleTypeEnum.AppCss,
        language: LanguageEnum.CSS
    },
    "Style:TailwindConfig": {
        id: "tailwind-config",
        canonicalPath: "tailwind.config.ts",
        filetype: FileTypeEnum.Style,
        subtype: StyleTypeEnum.TailwindConfig,
        generationPrompt: tailwindConfigPrompt,
        language: LanguageEnum.JSON
    },
}