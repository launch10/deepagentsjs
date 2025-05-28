import type { FileSystemTree } from '@webcontainer/api';
import type { FileMap, FileData } from '@shared/models/file';

interface FileSystemFileEntry {
  file: {
    contents: string | Uint8Array;
  };
}

interface FileSystemDirectoryEntry {
  directory: FileSystemTree;
}

type UnknownFileCollection = FileMap | FileSystemTree | FileData[];

export function toFileMap(input: UnknownFileCollection): FileMap {
  const fileMap: FileMap = {};

  if (Array.isArray(input)) {
    (input as FileData[]).forEach((fileData) => {
      fileMap[fileData.path] = fileData;
    });
  } else if (typeof input === 'object') {
    const values = Object.values(input);
    if (values.every((value) => typeof value === 'object' && 'directory' in value)) {
      values.forEach((value) => {
        const fileMap = toFileMap(value.directory);
        Object.assign(fileMap, value.directory);
      });
    } else {
      return input as FileMap;
    }
  }
  
  return fileMap;
}

export function convertFileMapToFileSystemTree(fileMap: FileMap): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const filePath in fileMap) {
    if (!Object.prototype.hasOwnProperty.call(fileMap, filePath)) {
      continue;
    }

    const fileData: FileData | undefined = fileMap[filePath];
    if (!fileData || typeof fileData.content !== 'string') {
        console.warn(`Skipping file due to missing or invalid data: ${filePath}`);
        continue;
    }

    const segments = filePath.split('/').filter(segment => segment.length > 0);
    let currentLevel = tree;

    segments.forEach((segment, index) => {
      const isLastSegment = index === segments.length - 1;

      if (isLastSegment) {
        currentLevel[segment] = {
          file: { contents: fileData.content },
        } as FileSystemFileEntry;
      } else {
        if (!currentLevel[segment]) {
          currentLevel[segment] = { directory: {} } as FileSystemDirectoryEntry;
        } else if (!(currentLevel[segment] as FileSystemDirectoryEntry).directory) {
          console.warn(`Conflict: Path '${filePath}' requires '${segment}' to be a directory, but it was not. Overwriting with directory.`);
          currentLevel[segment] = { directory: {} } as FileSystemDirectoryEntry;
        }
        currentLevel = (currentLevel[segment] as FileSystemDirectoryEntry).directory;
      }
    });
  }
  return tree;
}
