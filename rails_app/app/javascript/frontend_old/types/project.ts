export interface APIProject {
  id: number;
  thread_id: string;
  project_name: string;
  created_at: string;
  updated_at: string;
}
export interface Project {
  id: number;
  threadId: string;
  projectName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UnknownProjectType = APIProject | Project;
export type MaybeProjectArray = UnknownProjectType | UnknownProjectType[];

export function isAPIProject(project: UnknownProjectType): project is APIProject {
  return "thread_id" in project;
}

export function isProject(project: UnknownProjectType): project is Project {
  return "threadId" in project;
}

export function normalize(project: MaybeProjectArray): Project[] {
  if (Array.isArray(project)) {
    return project.map((p) => normalizeOneProject(p));
  }
  return [normalizeOneProject(project)];
}

function normalizeOneProject(project: UnknownProjectType): Project {
  if (isAPIProject(project)) {
    return {
      id: project.id,
      threadId: project.thread_id,
      projectName: project.project_name,
      createdAt: new Date(project.created_at),
      updatedAt: new Date(project.updated_at),
    };
  }
  return {
    id: project.id,
    threadId: project.threadId,
    projectName: project.projectName,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
