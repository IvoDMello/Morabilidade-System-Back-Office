import { avatarColorFromName, initialsFromName } from "@/constants/semantic-colors";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-11 w-11 text-sm",
} as const;

interface AvatarInitialsProps {
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

/**
 * Avatar de iniciais com cor derivada do nome (determinística) a partir da
 * paleta semântica única. Dá identidade visual por pessoa nas listas —
 * ver constants/semantic-colors.ts.
 */
export function AvatarInitials({ name, size = "md", className }: AvatarInitialsProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        SIZE_CLASSES[size],
        className,
      )}
      style={{ backgroundColor: avatarColorFromName(name) }}
    >
      {initialsFromName(name)}
    </span>
  );
}
