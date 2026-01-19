import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";

export interface ImagesManagerUploadProps {
  onClick?: () => void;
}

export function ImagesManagerUpload({ onClick }: ImagesManagerUploadProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="size-20 rounded border border-dashed border-neutral-300 bg-white flex items-center justify-center hover:border-base-400 transition-colors"
      aria-label="Upload image"
    >
      <ArrowUpTrayIcon className="size-4 text-base-100" />
    </button>
  );
}
