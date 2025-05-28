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

export type UnknownProjectType = ApiProject | Project;
export type MaybeProjectArray = UnknownProjectType | UnknownProjectType[];

export function isApiProject(project: UnknownProjectType): project is ApiProject {
  return 'thread_id' in project;
}

export function isProject(project: UnknownProjectType): project is Project {
  return 'threadId' in project;
}

export function normalize(project: MaybeProjectArray): Project[] {
    if (Array.isArray(project)) {
      return project.map((p) => normalizeOneProject(p));
    }
    return [normalizeOneProject(project)];
}

function normalizeOneProject(project: UnknownProjectType): Project {
  if (isApiProject(project)) {
    return {
        threadId: project.thread_id,
        projectName: project.project_name,
        createdAt: new Date(project.created_at),
        updatedAt: new Date(project.updated_at),
      };
  }
  return {
    threadId: project.threadId,
    projectName: project.projectName,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}