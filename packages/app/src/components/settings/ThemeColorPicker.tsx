/**
 * ThemeColorPicker — hex color input with a small color swatch preview.
 * Uses react-colorful for the color picker popover.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";

interface ThemeColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
  description?: string;
}

export function ThemeColorPicker({ value, onChange, label, description }: ThemeColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);
      // Only propagate valid hex
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        onChange(val);
      }
    },
    [onChange],
  );

  const handlePickerChange = useCallback(
    (color: string) => {
      setInputValue(color);
      onChange(color);
    },
    [onChange],
  );

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <span className="text-sm text-foreground">{label}</span>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="relative flex items-center gap-2" ref={popoverRef}>
        <button
          type="button"
          className="h-7 w-7 rounded-md border border-border shadow-sm transition-shadow hover:shadow-md"
          style={{ backgroundColor: value }}
          onClick={() => setIsOpen(!isOpen)}
        />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          className="w-[80px] rounded-md border border-border bg-background px-2 py-1 text-xs font-mono text-foreground"
          placeholder="#000000"
        />
        {isOpen && (
          <div className="absolute right-0 top-9 z-50 rounded-lg border bg-background p-3 shadow-xl">
            <HexColorPicker color={value} onChange={handlePickerChange} />
          </div>
        )}
      </div>
    </div>
  );
}
