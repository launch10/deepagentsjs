import { map, type MapStore } from 'nanostores';

export enum InitializationStatus {
    CREATED = "Created",
    FILES_MOUNTED = "FilesMounted",
    DEPENDENCIES_INSTALLED = "DependenciesInstalled",
    SERVER_STARTED = "ServerStarted",
    FAILED = "Failed"
}

export interface ApiProject {
  thread_id: string;
  project_name: string;
  created_at: string;
  updated_at: string;
}
export interface Project {
  threadId: string;
  projectName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Projects = MapStore<Record<string, Project>>;

export class ProjectStore {
  projects: Projects = map({});

  addProjects(projects: ApiProject[]) {
    projects.forEach((project) => {
      this.addProject(project);
    });
  }

  addProject(project: ApiProject) {
    this.projects.setKey(project.thread_id, {
      threadId: project.thread_id,
      projectName: project.project_name,
      createdAt: new Date(project.created_at),
      updatedAt: new Date(project.updated_at),
    });
  }
}

export const projectStore = new ProjectStore();