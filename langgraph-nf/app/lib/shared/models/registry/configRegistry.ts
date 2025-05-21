import { type FileSpecification } from "../fileSpecification";
import { FileTypeEnum,
         ConfigTypeEnum, 
         LanguageEnum,
        } from "../enums";

export const configRegistry: Record<string, FileSpecification> = {
    "Config:PackageJson": {
        id: "package-json",
        canonicalPath: "package.json",
        filetype: FileTypeEnum.Config,
        subtype: ConfigTypeEnum.PackageJson,
        language: LanguageEnum.JSON
    },
    "Config:TsConfig": {
        id: "tsconfig",
        canonicalPath: "tsconfig.json",
        filetype: FileTypeEnum.Config,
        subtype: ConfigTypeEnum.TsConfig,
        language: LanguageEnum.JSON
    },
    "Config:EslintConfig": {
        id: "eslint-config",
        canonicalPath: ".eslintrc.json",
        filetype: FileTypeEnum.Config,
        subtype: ConfigTypeEnum.EslintConfig,
        language: LanguageEnum.JSON
    },
    "Config:ViteConfig": {
        id: "vite-config",
        canonicalPath: "vite.config.js",
        filetype: FileTypeEnum.Config,
        subtype: ConfigTypeEnum.ViteConfig,
        language: LanguageEnum.JSON
    }
}