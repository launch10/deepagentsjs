import {
  map,
  atom,
  type WritableAtom,
  type MapStore,
  computed,
  type ReadableAtom,
} from "nanostores";
import {
  type Project,
  type MaybeProjectArray,
  normalize as normalizeProjects,
} from "@types/project";
import type { FileMap } from "@shared/models/file";

export enum InitializationStatus {
  CREATED = "Created",
  FILES_MOUNTED = "FilesMounted",
  DEPENDENCIES_INSTALLED = "DependenciesInstalled",
  SERVER_STARTED = "ServerStarted",
  FAILED = "Failed",
}
export class ProjectStore {
  projects: WritableAtom<Project[]> = atom([]);
  projectsById: MapStore<Record<string, Project>> = map({});
  projectFiles: MapStore<Record<string, FileMap>> = map({});

  add(projects: MaybeProjectArray): void {
    const normalized: Project[] = normalizeProjects(projects);
    const existingProjects: Record<string, Project> = this.projectsById.get();
    const deduped: Project[] = [
      ...new Map([
        ...normalized.map((project) => [project.threadId, project]),
        ...Object.entries(existingProjects),
      ]).values(),
    ] as Project[];
    deduped.forEach((project) => this.projectsById.setKey(project.threadId, project));

    const sortedProjects = deduped.sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    this.projects.set(sortedProjects);
  }

  addFiles(projectId: string, files: FileMap) {
    this.projectFiles.setKey(projectId, files);
  }

  remove(projectId: string): void {
    this.projectsById.setKey(projectId, undefined);
    this.projectFiles.setKey(projectId, undefined);

    // Update the projects array by filtering out the removed project
    const currentProjects = this.projects.get();
    const filteredProjects = currentProjects.filter((p) => p.threadId !== projectId);
    this.projects.set(filteredProjects);
  }

  // getProjectFiles(projectId: string): ReadableAtom<FileMap | undefined> {
  //   // This computed store will hold the FileMap for the specific projectId.
  //   // It will only update listeners if the FileMap for this specific projectId changes,
  //   // or if the key for this projectId is added or removed.
  //   return computed(this.projectFiles, allProjectFilesMap => {
  //     return allProjectFilesMap[projectId];
  //   });
  // }
}

export const projectStore = new ProjectStore();
