import { PhotoIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { cn } from "@lib/utils";
import type { ImageItem } from "./ImagesManager";
import { Button } from "@components/ui/button";

export interface ImageThumbnailProps {
  image?: ImageItem;
  isSelected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
}

export function ImagesManagerThumbnail({
  image,
  isSelected,
  onSelect,
  onRemove,
}: ImageThumbnailProps) {
  const hasImage = image?.src;

  return (
    <div
      className={cn(
        "relative size-20 rounded-lg overflow-hidden transition-all",
        isSelected && "border border-base-500",
        !isSelected && "hover:ring-2 hover:ring-primary-400 hover:ring-offset-1"
      )}
    >
      <Button
        variant="ghost"
        onClick={onSelect}
        className={cn(
          "size-20 rounded bg-neutral-100 relative",
          hasImage ? "p-0" : "flex items-center justify-center"
        )}
      >
        {hasImage ? (
          <img
            src={image.src}
            alt={image.alt || "Image"}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <PhotoIcon className="size-4 text-base-100" />
        )}
      </Button>
      {isSelected && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="absolute top-1 right-1 size-3.5 rounded-full bg-white border border-white shadow-sm flex items-center justify-center hover:bg-neutral-50"
          aria-label="Remove image"
        >
          <XMarkIcon className="size-2.5 text-primary-800" />
        </button>
      )}
    </div>
  );
}
