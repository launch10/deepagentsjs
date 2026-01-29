import { usePage } from "@inertiajs/react";
import { Link } from "@inertiajs/react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@components/ui/button";

interface ProjectsPageProps {
  projects: Array<{
    id: number;
    uuid: string;
    website_id: number | null;
    account_id: number;
    name: string;
    created_at: string;
    updated_at: string;
  }>;
  total_count: number;
}

export default function Projects() {
  const { projects, total_count } = usePage<ProjectsPageProps>().props;

  return (
    <div className="flex flex-col h-full px-8 pt-12">
      <div>
        <h1 className="font-serif text-[28px] font-semibold leading-8 text-base-500">
          Your Projects
        </h1>
        {total_count > 0 && (
          <p className="mt-2 font-sans text-lg leading-[22px] text-base-400/70">
            {total_count} total project{total_count !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {projects.length === 0 ? <EmptyState /> : <div>{/* Future: project cards grid */}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5">
      <img src="/images/empty-folder.png" alt="No projects" className="w-[175px] h-[175px]" />
      <div className="flex flex-col items-center gap-3">
        <h2 className="font-sans text-lg font-semibold leading-[22px] text-base-500">
          No projects yet
        </h2>
        <p className="font-sans text-base leading-5 text-base-300 text-center max-w-[406px]">
          Create your first landing page and ad campaign to start acquiring customers in minutes
        </p>
      </div>
      <Button asChild>
        <Link href="/projects/new">
          <PlusIcon className="w-4 h-4" />
          Create Your First Project
        </Link>
      </Button>
    </div>
  );
}
