import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { FILE_INPUT_ACCEPT } from "~/types/attachment";
import { useChatComposer, useChatIsStreaming } from "../ChatContext";

export interface FileButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "onClick"
> {
  /**
   * Button children (usually an icon).
   */
  children?: ReactNode;
  /**
   * Custom file selection handler. If not provided, uses composer.addFiles.
   */
  onFilesSelected?: (files: FileList) => void;
  /**
   * Custom accept attribute for file input.
   * Defaults to FILE_INPUT_ACCEPT (images + PDFs).
   */
  accept?: string;
  /**
   * Allow multiple file selection.
   * @default true
   */
  multiple?: boolean;
}

/**
 * Chat.Input.FileButton - Context-aware file upload button.
 *
 * Opens a file picker and adds selected files to the composer.
 * Disabled when streaming.
 *
 * @example
 * ```tsx
 * <Chat.Root chat={chat}>
 *   <Chat.Input.FileButton>
 *     <DocumentPlusIcon className="w-6 h-6" />
 *   </Chat.Input.FileButton>
 * </Chat.Root>
 * ```
 */
export function FileButton({
  children,
  onFilesSelected,
  accept = FILE_INPUT_ACCEPT,
  multiple = true,
  disabled,
  className,
  ...props
}: FileButtonProps) {
  const composer = useChatComposer()
  const isStreaming = useChatIsStreaming()
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (onFilesSelected) {
        onFilesSelected(files);
      } else {
        composer.addFiles(files);
      }
    }
    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled ?? isStreaming}
        className={twMerge(
          "p-0",
          "hover:opacity-70 transition-opacity",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      >
        {children}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}
