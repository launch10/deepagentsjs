import { Website } from "../types";

export function filesToFileMap(files: Website.File.File[]): Website.File.FileMap {
  return files.reduce((acc, file) => {
    if (!file.path) {
      return acc;
    }
    acc[file.path] = file;
    return acc;
  }, {} as Website.File.FileMap);
}
