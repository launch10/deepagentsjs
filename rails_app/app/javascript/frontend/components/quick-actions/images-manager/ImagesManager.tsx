import { CardContent } from "@components/ui/card";
import { ArrowUpTrayIcon } from "@heroicons/react/16/solid";
import { ImagesManagerThumbnail } from "./ImagesManagerThumbnail";
import { ImagesManagerUpload } from "./ImagesManagerUpload";

export interface ImageItem {
  id: string;
  src?: string;
  alt?: string;
}

export interface ImagesManagerViewProps {
  images: ImageItem[];
  selectedIds?: string[];
  onImageSelect?: (id: string) => void;
  onImageRemove?: (id: string) => void;
  onUpload?: () => void;
}

export function ImagesManagerView({
  images,
  selectedIds = [],
  onImageSelect,
  onImageRemove,
  onUpload,
}: ImagesManagerViewProps) {
  return (
    <CardContent className="px-4 py-4 flex flex-col gap-3">
      <span className="text-xs font-medium text-base-400">Images</span>
      <div className="grid grid-cols-3 gap-2.5">
        {images.map((image) => (
          <ImagesManagerThumbnail
            key={image.id}
            image={image}
            isSelected={selectedIds.includes(image.id)}
            onSelect={() => onImageSelect?.(image.id)}
            onRemove={() => onImageRemove?.(image.id)}
          />
        ))}
        <ImagesManagerUpload onClick={onUpload} />
      </div>
    </CardContent>
  );
}

export default function ImagesManager() {
  // TODO: Wire up to actual state management
  const images: ImageItem[] = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }];

  const selectedIds = ["1", "2", "3"];

  const handleImageSelect = (id: string) => {
    console.log("Image selected:", id);
  };

  const handleImageRemove = (id: string) => {
    console.log("Image removed:", id);
  };

  const handleUpload = () => {
    console.log("Upload clicked");
  };

  return (
    <ImagesManagerView
      images={images}
      selectedIds={selectedIds}
      onImageSelect={handleImageSelect}
      onImageRemove={handleImageRemove}
      onUpload={handleUpload}
    />
  );
}
