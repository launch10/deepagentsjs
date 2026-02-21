import type { Meta, StoryObj } from "@storybook/react-vite";
import InProgressScreen from "~/components/deploy/screens/InProgressScreen";
import { Deploy } from "@shared";

type GraphTask = NonNullable<Deploy.DeployGraphState["tasks"]>[number];

function mockTask(overrides: Pick<GraphTask, "name" | "description" | "status">): GraphTask {
  return { id: crypto.randomUUID(), retryCount: 0, ...overrides };
}

const websiteTasks: GraphTask[] = [
  mockTask({ name: "ValidateLinks", description: "Testing Links", status: "completed" }),
  mockTask({ name: "RuntimeValidation", description: "Checking For Bugs", status: "completed" }),
  mockTask({ name: "OptimizingSEO", description: "Optimizing SEO", status: "running" }),
  mockTask({ name: "AddingAnalytics", description: "Adding Analytics", status: "pending" }),
  mockTask({ name: "DeployingWebsite", description: "Launching Website", status: "pending" }),
];

const campaignTasks: GraphTask[] = [
  mockTask({ name: "ConnectingGoogle", description: "Signing into Google", status: "completed" }),
  mockTask({
    name: "VerifyingGoogle",
    description: "Verifying Google Account",
    status: "completed",
  }),
  mockTask({
    name: "CheckingBilling",
    description: "Checking Payment Status",
    status: "completed",
  }),
  mockTask({ name: "ValidateLinks", description: "Testing Links", status: "completed" }),
  mockTask({ name: "RuntimeValidation", description: "Checking For Bugs", status: "running" }),
  mockTask({ name: "OptimizingSEO", description: "Optimizing SEO", status: "pending" }),
  mockTask({ name: "AddingAnalytics", description: "Adding Analytics", status: "pending" }),
  mockTask({ name: "DeployingWebsite", description: "Launching Website", status: "pending" }),
  mockTask({ name: "DeployingCampaign", description: "Syncing Campaign", status: "pending" }),
  mockTask({ name: "EnablingCampaign", description: "Enabling Campaign", status: "pending" }),
];

const websiteInstructions: Deploy.Instructions = { website: true, googleAds: false };
const campaignInstructions: Deploy.Instructions = { website: true, googleAds: true };

const meta = {
  title: "Deploy/InProgressScreen",
  component: InProgressScreen,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[800px] border border-neutral-300 bg-white rounded-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InProgressScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WebsiteNoTasks: Story = {
  args: {
    instructions: websiteInstructions,
  },
};

export const WebsiteInProgress: Story = {
  args: {
    instructions: websiteInstructions,
    tasks: websiteTasks,
  },
};

export const WebsiteNearComplete: Story = {
  args: {
    instructions: websiteInstructions,
    tasks: websiteTasks.map((t, i) => (i < 4 ? { ...t, status: "completed" as const } : t)),
  },
};

export const CampaignInProgress: Story = {
  args: {
    instructions: campaignInstructions,
    tasks: campaignTasks,
  },
};

export const WebsiteJustStarted: Story = {
  args: {
    instructions: websiteInstructions,
    tasks: websiteTasks.map((t, i) =>
      i === 0 ? { ...t, status: "running" as const } : { ...t, status: "pending" as const }
    ),
  },
};
