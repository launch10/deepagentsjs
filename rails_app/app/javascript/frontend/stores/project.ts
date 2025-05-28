import { map, atom, type WritableAtom, type MapStore } from 'nanostores';
import { 
  type Project, 
  type MaybeProjectArray, 
  normalize as normalizeProjects,
} from '@types/project';

export enum InitializationStatus {
    CREATED = "Created",
    FILES_MOUNTED = "FilesMounted",
    DEPENDENCIES_INSTALLED = "DependenciesInstalled",
    SERVER_STARTED = "ServerStarted",
    FAILED = "Failed"
}
export class ProjectStore {
  projects: WritableAtom<Project[]> = atom([]);
  projectsById: MapStore<Record<string, Project>> = map({});

  add(projects: MaybeProjectArray): void {
    const normalized: Project[] = normalizeProjects(projects);
    const deduped = [...new Map(normalized.map((project) => [project.threadId, project])).values()];
    deduped.forEach((project) => this.projectsById.setKey(project.threadId, project));

    const sortedProjects = deduped.sort((a, b) => {
      return (
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime()
      );
    });
    this.projects.set(sortedProjects);
  }
}

export const projectStore = new ProjectStore();