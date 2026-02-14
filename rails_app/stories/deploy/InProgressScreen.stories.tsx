import type { Meta, StoryObj } from "@storybook/react-vite";
import InProgressScreen from "~/components/deploy/screens/InProgressScreen";

const websiteTasks = [
  { name: "ValidateLinks", description: "Testing Links", status: "completed" as const, result: {} },
  {
    name: "RuntimeValidation",
    description: "Checking For Bugs",
    status: "completed" as const,
    result: {},
  },
  { name: "OptimizingSEO", description: "Optimizing SEO", status: "running" as const, result: {} },
  {
    name: "AddingAnalytics",
    description: "Adding Analytics",
    status: "pending" as const,
    result: {},
  },
  {
    name: "DeployingWebsite",
    description: "Launching Website",
    status: "pending" as const,
    result: {},
  },
];

const campaignTasks = [
  {
    name: "ConnectingGoogle",
    description: "Signing into Google",
    status: "completed" as const,
    result: {},
  },
  {
    name: "VerifyingGoogle",
    description: "Verifying Google Account",
    status: "completed" as const,
    result: {},
  },
  {
    name: "CheckingBilling",
    description: "Checking Payment Status",
    status: "completed" as const,
    result: {},
  },
  { name: "ValidateLinks", description: "Testing Links", status: "completed" as const, result: {} },
  {
    name: "RuntimeValidation",
    description: "Checking For Bugs",
    status: "running" as const,
    result: {},
  },
  { name: "OptimizingSEO", description: "Optimizing SEO", status: "pending" as const, result: {} },
  {
    name: "AddingAnalytics",
    description: "Adding Analytics",
    status: "pending" as const,
    result: {},
  },
  {
    name: "DeployingWebsite",
    description: "Launching Website",
    status: "pending" as const,
    result: {},
  },
  {
    name: "DeployingCampaign",
    description: "Syncing Campaign",
    status: "pending" as const,
    result: {},
  },
  {
    name: "EnablingCampaign",
    description: "Enabling Campaign",
    status: "pending" as const,
    result: {},
  },
];

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
    deployType: "website",
  },
};

export const WebsiteInProgress: Story = {
  args: {
    deployType: "website",
    tasks: websiteTasks,
  },
};

export const WebsiteNearComplete: Story = {
  args: {
    deployType: "website",
    tasks: websiteTasks.map((t, i) => (i < 4 ? { ...t, status: "completed" as const } : t)),
  },
};

export const CampaignInProgress: Story = {
  args: {
    deployType: "campaign",
    tasks: campaignTasks,
  },
};

export const WebsiteJustStarted: Story = {
  args: {
    deployType: "website",
    tasks: websiteTasks.map((t, i) =>
      i === 0 ? { ...t, status: "running" as const } : { ...t, status: "pending" as const }
    ),
  },
};
