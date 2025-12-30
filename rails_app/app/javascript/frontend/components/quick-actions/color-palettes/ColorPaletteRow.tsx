import { cn } from "@lib/utils";

export interface ColorPaletteRowProps {
  colors: string[];
  onClick?: () => void;
}

export default function ColorPaletteRow({ colors, onClick }: ColorPaletteRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full h-8 rounded overflow-hidden hover:ring-2 hover:ring-primary-400 hover:ring-offset-1 transition-all cursor-pointer"
    >
      {colors.map((color, index) => (
        <div
          key={index}
          className={cn(
            "flex-1 h-full",
            index === 0 && "rounded-l",
            index === colors.length - 1 && "rounded-r"
          )}
          style={{ backgroundColor: color }}
          aria-label={`Color ${color}`}
        />
      ))}
    </button>
  );
}
