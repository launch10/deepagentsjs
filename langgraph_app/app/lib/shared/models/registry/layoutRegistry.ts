import { type FileSpecification } from "../fileSpecification";
import { FileTypeEnum,
         LanguageEnum,
         LayoutTypeEnum
        } from "../enums";

export const layoutRegistry: Record<string, FileSpecification> = {
    "Layout:Nav": {
        id: "nav-layout",
        canonicalPath: "src/components/Nav.tsx",
        filetype: FileTypeEnum.Layout,
        subtype: LayoutTypeEnum.Nav,
        language: LanguageEnum.TSX
    },
    "Layout:Footer": {
        id: "footer-layout",
        canonicalPath: "src/components/Footer.tsx",
        filetype: FileTypeEnum.Layout,
        subtype: LayoutTypeEnum.Footer,
        language: LanguageEnum.TSX
    },
    "Layout:Sidebar": {
        id: "sidebar-layout",
        canonicalPath: "src/components/Sidebar.tsx",
        filetype: FileTypeEnum.Layout,
        subtype: LayoutTypeEnum.Sidebar,
        language: LanguageEnum.TSX
    },
}