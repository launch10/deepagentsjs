// Context-aware input components
export { Textarea, type TextareaProps } from "./Textarea";
export { SubmitButton, type SubmitButtonProps } from "./SubmitButton";
export { FileButton, type FileButtonProps } from "./FileButton";
export { DropZone, type DropZoneProps } from "./DropZone";
export { AttachmentList, type AttachmentListProps } from "./AttachmentList";
export { CreditGate, type CreditGateProps } from "./CreditGate";

// Compound component object for Chat.Input.* usage
import { Textarea } from "./Textarea";
import { SubmitButton } from "./SubmitButton";
import { FileButton } from "./FileButton";
import { DropZone } from "./DropZone";
import { AttachmentList } from "./AttachmentList";
import { CreditGate } from "./CreditGate";

export const Input = {
  Textarea,
  SubmitButton,
  FileButton,
  DropZone,
  AttachmentList,
  CreditGate,
};
