import { useMemo } from "react";
import { Checklist, ChecklistItem, type ChecklistItemStatus } from "@components/shared/checklist";
import { Deploy } from "@shared";
import {
  BugAntIcon,
  ChatBubbleBottomCenterTextIcon,
  ChartBarIcon,
  RocketLaunchIcon,
  MegaphoneIcon,
  BoltIcon,
  CreditCardIcon,
  SignalIcon,
} from "@heroicons/react/24/solid";
import type { ComponentType, SVGProps } from "react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** Google "G" icon as inline SVG component */
function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * Maps phase names to their fixed icons for the deploy sidebar.
 */
const PHASE_ICON_MAP: Record<Deploy.PhaseName, IconComponent> = {
  ConnectingGoogle: GoogleIcon as IconComponent,
  VerifyingGoogle: SignalIcon,
  CheckingBilling: CreditCardIcon,
  CheckingForBugs: BugAntIcon,
  FixingBugs: BugAntIcon,
  OptimizingSEO: ChatBubbleBottomCenterTextIcon,
  AddingAnalytics: ChartBarIcon,
  DeployingWebsite: RocketLaunchIcon,
  DeployingCampaign: MegaphoneIcon,
  EnablingCampaign: BoltIcon,
};

/** Sidebar-friendly labels (shorter than TaskDescriptionMap) */
const PHASE_LABELS: Record<Deploy.PhaseName, string> = {
  ConnectingGoogle: "Signing into Google",
  VerifyingGoogle: "Verifying Google Account",
  CheckingBilling: "Checking payment status",
  CheckingForBugs: "Checking for bugs",
  FixingBugs: "Squashing bugs",
  OptimizingSEO: "Optimizing SEO",
  AddingAnalytics: "Connecting Analytics",
  DeployingWebsite: "Launching Website",
  DeployingCampaign: "Syncing Campaign",
  EnablingCampaign: "Enabling Campaign",
};

function toChecklistStatus(phaseStatus: string): ChecklistItemStatus {
  switch (phaseStatus) {
    case "completed":
    case "passed":
      return "completed";
    case "running":
      return "in_progress";
    default:
      return "pending";
  }
}

type GraphTask = NonNullable<Deploy.DeployGraphState["tasks"]>[number];

/** Compute phase status from lightweight graph state tasks */
function computePhaseStatusFromGraphTasks(
  phaseName: Deploy.PhaseName,
  graphTasks: GraphTask[]
): string {
  const taskNames = Deploy.PhaseTaskMap[phaseName];
  const phaseTasks = graphTasks.filter((t) => taskNames.includes(t.name as Deploy.TaskName));

  if (phaseTasks.length === 0) return "pending";
  if (phaseTasks.some((t) => t.status === "running")) return "running";

  // A task is "done" if it reached any terminal state (completed, skipped, or failed-recoverable)
  const isTerminal = (status: string) =>
    status === "completed" || status === "skipped" || status === "failed" || status === "passed";
  if (phaseTasks.every((t) => isTerminal(t.status))) return "completed";

  return "pending";
}

interface PhaseDisplay {
  name: Deploy.PhaseName;
  status: string;
}

interface DeployTaskListProps {
  deployType: "website" | "campaign";
  tasks?: Deploy.DeployGraphState["tasks"];
}

/**
 * Deploy task checklist for the sidebar. Uses the shared Checklist compound component.
 * Filters phases based on deploy type and shows task-specific icons.
 */
export default function DeployTaskList({ deployType, tasks }: DeployTaskListProps) {
  const isCampaign = deployType === "campaign";
  const title = isCampaign ? "Launching Campaign" : "Launching Website";

  // Determine which phases to show based on deploy instructions
  const instructions: Deploy.Instructions = {
    website: true,
    googleAds: isCampaign,
  };

  // Compute phases from current tasks (lightweight graph state tasks)
  const phases: PhaseDisplay[] = useMemo(() => {
    const relevantTaskNames = Deploy.findTasks(instructions);
    const graphTasks = tasks ?? [];

    return (Deploy.PhaseNames as readonly Deploy.PhaseName[])
      .filter((phaseName) => {
        const phaseTasks = Deploy.PhaseTaskMap[phaseName];
        // Show phase if any of its constituent tasks are in the relevant set
        const isRelevant = phaseTasks.some((taskName) => relevantTaskNames.includes(taskName));
        if (!isRelevant) return false;

        // Hide FixingBugs unless it actually has a task (only shows when validation fails)
        if (phaseName === "FixingBugs") {
          const fixingBugsTask = graphTasks.find((t) => t.name === "FixingBugs");
          if (!fixingBugsTask) return false;
        }
        return true;
      })
      .map((phaseName) => ({
        name: phaseName,
        status: computePhaseStatusFromGraphTasks(phaseName, graphTasks),
      }));
  }, [tasks, isCampaign]);

  return (
    <Checklist.Root title={title}>
      {phases.length > 0 ? (
        <Checklist.Items>
          {phases.map((phase) => (
            <ChecklistItem
              key={phase.name}
              icon={PHASE_ICON_MAP[phase.name]}
              label={PHASE_LABELS[phase.name]}
              status={toChecklistStatus(phase.status)}
            />
          ))}
        </Checklist.Items>
      ) : (
        <Checklist.Empty message="Preparing deployment..." />
      )}
    </Checklist.Root>
  );
}
