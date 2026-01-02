import type { ImageMessageBlock } from "langgraph-ai-sdk-types";

interface MessageImagesProps {
  images: ImageMessageBlock[];
}

/**
 * Displays images that were sent with a message.
 * Simpler than input attachments - no upload state, just display.
 */
export function MessageImages({ images }: MessageImagesProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2" data-testid="message-images">
      {images.map((image) => (
        <div
          key={image.id}
          className="relative w-[110px] h-[104px] rounded-lg overflow-hidden border border-neutral-200"
        >
          <img
            src={image.url}
            alt="Attached image"
            crossOrigin="anonymous"
            className="w-full h-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}
