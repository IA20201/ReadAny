/**
 * InlineColorPicker — half-sheet modal color picker.
 *
 * CRITICAL: reanimated-color-picker uses PanGestureHandler internally.
 * It MUST be inside a <Modal> to get an isolated native view hierarchy.
 * Without Modal, gesture events dispatched to Reanimated worklets cause SIGABRT.
 *
 * This component uses <Modal transparent> to create a half-screen bottom panel.
 * The upper portion is transparent so the color slot list remains partially visible.
 * Color changes are local-only; the parent flushes to store on "Done".
 */
import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ColorPicker, { HueSlider, Panel1 } from "reanimated-color-picker";
import { fontSize, fontWeight, radius, spacing } from "@/styles/theme";

interface Props {
  /** Initial color when the picker opens — stable, never updates mid-gesture */
  initialColor: string;
  /** Label shown above the picker */
  label: string;
  /** Called with final hex when user taps Done */
  onDone: (hex: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** UI colors passed in to avoid useColors() subscription inside picker */
  uiColors: {
    card: string;
    border: string;
    foreground: string;
    mutedForeground: string;
    background: string;
    primary: string;
    primaryForeground: string;
  };
}

export function InlineColorPicker({ initialColor, label, onDone, onCancel, uiColors }: Props) {
  const { t } = useTranslation();
  const [localHex, setLocalHex] = useState(initialColor);
  const localHexRef = useRef(initialColor);

  const handlePickerComplete = useCallback(({ hex }: { hex: string }) => {
    const normalized = hex.slice(0, 7);
    setLocalHex(normalized);
    localHexRef.current = normalized;
  }, []);

  const handleHexSubmit = useCallback(() => {
    const cleaned = localHex.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      localHexRef.current = cleaned;
      setLocalHex(cleaned);
    } else {
      setLocalHex(localHexRef.current);
    }
  }, [localHex]);

  const handleDone = useCallback(() => {
    onDone(localHexRef.current);
  }, [onDone]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      {/* Transparent upper area — tap to cancel */}
      <Pressable style={styles.backdrop} onPress={onCancel} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <View style={[styles.sheet, { backgroundColor: uiColors.card, borderTopColor: uiColors.border }]}>
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: uiColors.border }]} />

          {/* Header: Cancel — label — Done */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: uiColors.mutedForeground, fontSize: fontSize.sm }}>
                {t("common.cancel", "取消")}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.label, { color: uiColors.foreground }]} numberOfLines={1}>
              {label}
            </Text>
            <TouchableOpacity onPress={handleDone} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: uiColors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                {t("common.done", "完成")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Color picker — INSIDE Modal, safe from gesture SIGABRT */}
          <ColorPicker style={styles.picker} value={initialColor} onCompleteJS={handlePickerComplete}>
            <Panel1 style={styles.panel} />
            <HueSlider style={styles.slider} />
          </ColorPicker>

          {/* Hex input row */}
          <View style={styles.hexRow}>
            <View style={[styles.previewSwatch, { backgroundColor: localHex, borderColor: uiColors.border }]} />
            <Text style={[styles.hexLabel, { color: uiColors.mutedForeground }]}>HEX</Text>
            <TextInput
              style={[
                styles.hexInput,
                {
                  color: uiColors.foreground,
                  borderColor: uiColors.border,
                  backgroundColor: uiColors.background,
                },
              ]}
              value={localHex}
              onChangeText={(text) => {
                setLocalHex(text);
                if (/^#[0-9a-fA-F]{6}$/.test(text.trim())) {
                  localHexRef.current = text.trim();
                }
              }}
              onSubmitEditing={handleHexSubmit}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
              placeholder="#000000"
              placeholderTextColor={uiColors.mutedForeground}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Transparent — user can still see the slot list behind
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  sheetWrap: {
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    gap: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    flex: 1,
    textAlign: "center",
  },
  picker: {
    gap: 10,
  },
  panel: {
    height: 150,
    borderRadius: radius.md,
  },
  slider: {
    height: 28,
    borderRadius: radius.md,
  },
  hexRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewSwatch: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
  },
  hexLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: fontSize.sm,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
