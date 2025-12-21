import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SettingsFormItem from "@components/ads/forms/settings-form/LocationTargetingItem";
import { FormProvider, useForm } from "react-hook-form";
import {
  settingsFormSchema,
  type SettingsFormData,
} from "@components/ads/forms/settings-form/settingsForm.schema";
import { zodResolver } from "@hookform/resolvers/zod";

const meta = {
  title: "Ad Campaign/Settings Form Item",
  component: SettingsFormItem,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    location: {
      criteria_id: 9060323,
      name: "Historic Core",
      canonical_name: "Historic Core,California,United States",
      target_type: "Neighborhood",
      country_code: "US",
      radius: 11,
      isTargeted: false,
      id: "f82b7b6b-f493-4236-aebf-3ccc0ffd9662",
    },
    index: 0,
    handleRemoveLocation: () => {},
    handleToggleTargeted: () => {},
  },
  globals: {
    backgrounds: {
      default: "background",
    },
  },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient();
      const methods = useForm<SettingsFormData>({
        resolver: zodResolver(settingsFormSchema) as any,
        mode: "onChange",
        defaultValues: {
          settings: [],
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <FormProvider {...methods}>
            <Story />
          </FormProvider>
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof SettingsFormItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
