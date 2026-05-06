/**
 * ReadingProgressSlider — A draggable progress slider for the reader.
 *
 * Uses PanResponder for smooth drag interaction with 100ms debounce.
 */
import React, { useCallback, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";

interface Props {
  /** Current reading progress 0-1 */
  progress: number;
  /** Called when user seeks to a new position (0-1) */
  onSeek: (fraction: number) => void;
  /** Primary/accent color */
  accentColor?: string;
  /** Track background color */
  trackColor?: string;
  /** Text color for percentage label */
  textColor?: string;
}

const clamp = (val: number) => Math.max(0, Math.min(1, val));

export function ReadingProgressSlider({
  progress,
  onSeek,
  accentColor = "#3b82f6",
  trackColor = "rgba(255,255,255,0.15)",
  textColor = "rgba(255,255,255,0.7)",
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const trackWidthRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbScale = useRef(new Animated.Value(1)).current;

  const currentProgress = isDragging ? dragProgress : progress;
  const displayPercent = Math.round(currentProgress * 100);

  const debouncedSeek = useCallback(
    (fraction: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onSeek(fraction), 100);
    },
    [onSeek],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 2,
      onPanResponderGrant: (evt) => {
        setIsDragging(true);
        Animated.spring(thumbScale, { toValue: 1.5, useNativeDriver: true, friction: 8 }).start();
        const fraction = clamp(evt.nativeEvent.locationX / trackWidthRef.current);
        setDragProgress(fraction);
        debouncedSeek(fraction);
      },
      onPanResponderMove: (evt) => {
        const fraction = clamp(evt.nativeEvent.locationX / trackWidthRef.current);
        setDragProgress(fraction);
        debouncedSeek(fraction);
      },
      onPanResponderRelease: (evt) => {
        const fraction = clamp(evt.nativeEvent.locationX / trackWidthRef.current);
        setIsDragging(false);
        Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        onSeek(fraction);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      },
    }),
  ).current;

  const handleLayout = useCallback((e: any) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
  }, []);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: textColor }]}>{displayPercent}%</Text>
      <View style={styles.trackWrap} onLayout={handleLayout} {...panResponder.panHandlers}>
        <View style={[styles.track, { backgroundColor: trackColor }]}>
          <View
            style={[styles.fill, { backgroundColor: accentColor, width: `${currentProgress * 100}%` }]}
          />
        </View>
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: accentColor,
              left: `${currentProgress * 100}%`,
              transform: [{ scale: thumbScale }, { translateX: -7 }, { translateY: -7 }],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 2,
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    minWidth: 36,
    textAlign: "center",
  },
  trackWrap: {
    flex: 1,
    height: 32,
    justifyContent: "center",
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
  },
  thumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    top: "50%",
  },
});
