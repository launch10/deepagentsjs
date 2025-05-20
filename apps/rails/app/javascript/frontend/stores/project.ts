import { map, type MapStore } from 'nanostores';

export enum InitializationStatus {
    CREATED = "Created",
    FILES_MOUNTED = "FilesMounted",
    DEPENDENCIES_INSTALLED = "DependenciesInstalled",
    SERVER_STARTED = "ServerStarted",
    FAILED = "Failed"
}

export type Projects = MapStore<Record<string, { threadId: string; status: InitializationStatus }>>;

export class ProjectStore {
  projects: Projects = map({});

  addProject(threadId: string) {
    this.projects.setKey(threadId, { threadId, status: InitializationStatus.CREATED });
  }
}
