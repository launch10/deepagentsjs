import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea, FileButton } from "@components/shared/chat/input";
import { BaseDropZone, BaseAttachmentList } from "@components/shared/chat/attachments";
import { Chat } from "@components/shared/chat/Chat";
import { useAdsChat } from "@components/ads/hooks";

const meta: Meta = {
  title: "Chat/Input",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "500px" }}>
        <Chat.Root chat={useAdsChat()}>
          <Story />
        </Chat.Root>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj;

// Basic textarea - showing raw components for visual reference
// Note: Context-aware Input.* components require Chat.Root wrapper
export const TextareaOnly: Story = {
  render: () => (
    <div className="flex gap-2 items-end border rounded-lg p-2">
      <Textarea placeholder="Type a message..." />
    </div>
  ),
};

// With file button
export const WithFileButton: Story = {
  render: () => (
    <div className="flex gap-2 items-end border rounded-lg p-2">
      <FileButton onFilesSelected={() => {}}>📎</FileButton>
      <Textarea placeholder="Type a message..." />
    </div>
  ),
};

// BaseDropZone wrapper (for drag and drop without context)
export const WithDropZone: Story = {
  render: () => (
    <BaseDropZone onDrop={() => {}} className="border rounded-lg p-2">
      <Textarea placeholder="Drag files here or type..." />
    </BaseDropZone>
  ),
};

// With BaseAttachmentList (showing attachments without context)
export const WithAttachments: Story = {
  render: () => (
    <div className="border rounded-lg p-2 space-y-2">
      <BaseAttachmentList
        attachments={[
          { id: "1", type: "document", status: "completed" },
          { id: "2", type: "image", status: "completed", previewUrl: "https://picsum.photos/100" },
        ]}
        onRemove={() => {}}
      />
      <Textarea placeholder="Files attached above..." />
    </div>
  ),
};

// Disabled state
export const Disabled: Story = {
  render: () => (
    <div className="flex gap-2 items-end border rounded-lg p-2">
      <Textarea placeholder="Type a message..." disabled />
    </div>
  ),
};

// With value
export const WithValue: Story = {
  render: () => (
    <div className="flex gap-2 items-end border rounded-lg p-2">
      <Textarea
        value="I want to build an app that helps people find local farmers markets"
        onChange={() => {}}
      />
    </div>
  ),
};
