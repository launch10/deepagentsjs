import type { FileType, FileMap } from '@types';

export function filesToFileMap(files: FileType[]): FileMap {
  return files.reduce((acc, file) => {
    acc[file.path] = file;
    return acc;
  }, {} as FileMap);
}
