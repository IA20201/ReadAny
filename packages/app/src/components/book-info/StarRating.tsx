/**
 * StarRating — Interactive 1-5 star rating
 * Click to set, click same star to clear
 * Theme-aware amber color for filled stars
 */
import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
  value?: number; // 1-5 or undefined
  onChange: (value: number | undefined) => void;
  size?: number;
  readOnly?: boolean;
}

export function StarRating({
  value,
  onChange,
  size = 20,
  readOnly = false,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value ?? 0;

  return (
    <div
      className="flex gap-0.5"
      onMouseLeave={() => !readOnly && setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            className="transition-all duration-100 hover:scale-110 active:scale-95 disabled:cursor-default disabled:hover:scale-100"
            onMouseEnter={() => !readOnly && setHoverValue(star)}
            onClick={() => {
              if (readOnly) return;
              onChange(star === value ? undefined : star);
            }}
          >
            <Star
              style={{ width: size, height: size }}
              className={
                filled
                  ? "fill-[#f59e0b] text-[#f59e0b] drop-shadow-[0_1px_2px_rgba(245,158,11,0.3)]"
                  : "fill-none text-border transition-colors hover:text-[#f59e0b]/40"
              }
            />
          </button>
        );
      })}
    </div>
  );
}
