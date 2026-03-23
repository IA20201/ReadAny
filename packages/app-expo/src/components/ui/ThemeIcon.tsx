/**
 * ThemeIcon (React Native) — renders a theme-overridden SVG icon or falls back to default.
 *
 * Note: SVG string rendering in RN requires SvgXml from react-native-svg.
 * If the theme provides a custom SVG, we render it via SvgXml; otherwise
 * we render the default icon component.
 *
 * Usage:
 *   <ThemeIcon slot="bookOpen" fallback={BookOpenIcon} size={24} color="#000" />
 */
import { useThemeStore } from "@readany/core/stores";
import { getIconOverride } from "@readany/core/theme/icon-overrides";
import type { IconSlot } from "@readany/core/types";
import { memo, useMemo } from "react";
import { SvgXml } from "react-native-svg";

interface ThemeIconProps {
  /** Which icon slot to check for overrides */
  slot: IconSlot;
  /** Default icon component to render when no override exists */
  fallback: React.ComponentType<{ size?: number; color?: string }>;
  /** Icon size */
  size?: number;
  /** Icon color */
  color?: string;
}

export const ThemeIcon = memo(function ThemeIcon({
  slot,
  fallback: Fallback,
  size = 24,
  color,
}: ThemeIconProps) {
  const icons = useThemeStore((s) => s.getActiveTheme().icons);

  const svgOverride = useMemo(
    () => getIconOverride(icons, slot),
    [icons, slot],
  );

  if (svgOverride) {
    return (
      <SvgXml
        xml={svgOverride}
        width={size}
        height={size}
        color={color}
      />
    );
  }

  return <Fallback size={size} color={color} />;
});
