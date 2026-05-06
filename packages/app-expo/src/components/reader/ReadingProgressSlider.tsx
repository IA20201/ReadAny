/**
 * ReadingProgressSlider — A draggable progress slider for the reader.
 *
 * Uses gesture dx (delta from start) for reliable tracking on iOS.
 * Debounces seek at 100ms, with cooldown to prevent snap-back.
 */
import React, { useCallback, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";

interface Props {
  /** Current reading progress 0-1 */
  progress: number;
  /** Called when user seeks to a new position (0-1) */
  onSeek: (fraction: number) => void;
  /** Called when user starts dragging */
  onDragStart?: () => void;
  /** Called when user releases the slider */
  onDragEnd?: () => void;
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
  onDragStart,
  onDragEnd,
  accentColor = "#3b82f6",
  trackColor = "rgba(255,255,255,0.15)",
  textColor = "rgba(255,255,255,0.7)",
}: Props) {
  const [localProgress, setLocalProgress] = useState<number | null>(null);
  const trackWidthRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbScale = useRef(new Animated.Value(1)).current;
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Store the fraction at drag start so we can use dx for movement
  const startFractionRef = useRef(0);
  // Refs for callbacks to avoid stale closures in PanResponder
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Use local progress while dragging/cooldown, otherwise external progress
  const displayProgress = localProgress != null ? localProgress : progress;
  const displayPercent = Math.round(displayProgress * 100);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 3,
      onPanResponderGrant: (evt) => {
        if (cooldownRef.current) {
          clearTimeout(cooldownRef.current);
          cooldownRef.current = null;
        }
        // Calculate initial fraction from tap position
        const width = trackWidthRef.current;
        if (width > 0) {
          const tapFraction = clamp(evt.nativeEvent.locationX / width);
          startFractionRef.current = tapFraction;
          setLocalProgress(tapFraction);
        } else {
          startFractionRef.current = progressRef.current;
          setLocalProgress(progressRef.current);
        }
        onDragStartRef.current?.();
        Animated.spring(thumbScale, { toValue: 1.5, useNativeDriver: true, friction: 8 }).start();
      },
      onPanResponderMove: (_, gestureState) => {
        const width = trackWidthRef.current;
        if (width <= 0) return;
        // Use dx from the starting fraction for reliable tracking
        const fraction = clamp(startFractionRef.current + gestureState.dx / width);
        setLocalProgress(fraction);
        // Debounced seek
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onSeekRef.current(fraction);
        }, 100);
      },
      onPanResponderRelease: (_, gestureState) => {
        const width = trackWidthRef.current;
        const fraction = width > 0
          ? clamp(startFractionRef.current + gestureState.dx / width)
          : (localProgress ?? progressRef.current);
        Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setLocalProgress(fraction);
        onSeekRef.current(fraction);
        onDragEndRef.current?.();
        // Keep local progress for 600ms to avoid snap-back from WebView relocate
        cooldownRef.current = setTimeout(() => {
          cooldownRef.current = null;
          setLocalProgress(null);
        }, 600);
      },
      onPanResponderTerminate: () => {
        Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
        onDragEndRef.current?.();
        cooldownRef.current = setTimeout(() => {
          cooldownRef.current = null;
          setLocalProgress(null);
        }, 600);
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
            style={[styles.fill, { backgroundColor: accentColor, width: `${displayProgress * 100}%` }]}
          />
        </View>
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: accentColor,
              left: `${displayProgress * 100}%`,
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
