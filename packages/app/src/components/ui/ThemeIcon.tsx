/**
 * ThemeIcon — renders a theme-overridden SVG icon or falls back to a Lucide icon.
 *
 * Usage:
 *   <ThemeIcon slot="bookOpen" fallback={BookOpen} className="h-5 w-5" />
 */
import { useThemeStore } from "@readany/core/stores";
import { getIconOverride } from "@readany/core/theme/icon-overrides";
import type { IconSlot } from "@readany/core/types";
import { memo, useMemo } from "react";

interface ThemeIconProps {
  /** Which icon slot to check for overrides */
  slot: IconSlot;
  /** Icon component to render when no override exists */
  fallback: React.ComponentType<{ className?: string; size?: number; color?: string }>;
  /** Additional className */
  className?: string;
  /** Icon size (for the fallback) */
  size?: number;
  /** Icon color */
  color?: string;
}

export const ThemeIcon = memo(function ThemeIcon({
  slot,
  fallback: Fallback,
  className,
  size,
  color,
}: ThemeIconProps) {
  const icons = useThemeStore((s) => s.getActiveTheme().icons);

  const svgOverride = useMemo(
    () => getIconOverride(icons, slot),
    [icons, slot],
  );

  if (svgOverride) {
    return (
      <span
        className={className}
        style={{ color, display: "inline-flex", alignItems: "center" }}
        // biome-ignore lint: safe SVG from theme data
        dangerouslySetInnerHTML={{ __html: svgOverride }}
      />
    );
  }

  return <Fallback className={className} size={size} color={color} />;
});
