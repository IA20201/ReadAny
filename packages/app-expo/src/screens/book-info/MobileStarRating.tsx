/**
 * MobileStarRating — Touch-friendly star rating
 */
import { View, Pressable } from "react-native";
import { Star } from "lucide-react-native";
import { useColors } from "@/styles/theme";

interface MobileStarRatingProps {
  value?: number;
  onChange: (value: number | undefined) => void;
  size?: number;
  readOnly?: boolean;
}

export function MobileStarRating({
  value,
  onChange,
  size = 20,
  readOnly = false,
}: MobileStarRatingProps) {
  const colors = useColors();

  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          disabled={readOnly}
          onPress={() => onChange(star === value ? undefined : star)}
          hitSlop={6}
        >
          <Star
            size={size}
            color={star <= (value ?? 0) ? "#f59e0b" : colors.mutedForeground}
            fill={star <= (value ?? 0) ? "#f59e0b" : "none"}
          />
        </Pressable>
      ))}
    </View>
  );
}
