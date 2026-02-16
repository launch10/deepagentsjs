export interface DeployRecord {
  id: number;
  project_id: number;
  status: string;
  current_step: string | null;
  is_live: boolean;
  thread_id: string | null;
  instructions: Record<string, boolean>;
  support_ticket: string | null;
  finished_at: string | null;
  duration: number | null;
  revertible: boolean;
  website_deploy_status: string | null;
  created_at: string;
  updated_at: string;
}
