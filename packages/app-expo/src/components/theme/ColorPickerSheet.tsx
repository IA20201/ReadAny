/**
 * ColorPickerSheet — bottom-sheet modal with HSV color picker + hex input.
 *
 * CRITICAL (Reanimated 4): Use `onCompleteJS` / `onChangeJS` (not `onComplete` /
 * `onChange`) because the callbacks run on the UI thread (worklet). Normal JS
 * functions cause SIGABRT in Reanimated 4.
 *
 * Features:
 *   - Original color swatch for comparison (tap to restore)
 *   - Cancel restores original color via onCancel callback
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
import ColorPicker, {
  HueSlider,
  Panel1,
  Preview,
} from "reanimated-color-picker";
import { useColors } from "@/styles/theme";
import { fontSize, fontWeight, radius, spacing } from "@/styles/theme";

interface Props {
  visible: boolean;
  initialColor: string;
  /** Called with hex when user lifts finger or taps Done */
  onComplete: (hex: string) => void;
  /** Called when user cancels — parent should restore original color */
  onCancel?: (originalColor: string) => void;
  onClose: () => void;
  label?: string;
}

export function ColorPickerSheet({ visible, initialColor, onComplete, onCancel, onClose, label }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const [hexInput, setHexInput] = useState(initialColor);
  const [currentColor, setCurrentColor] = useState(initialColor);
  // Remember the color when the picker first opened — stable across drags
  const originalColorRef = useRef(initialColor);
  // Track previous visible to detect open transition
  const prevVisibleRef = useRef(false);
  // Stable value for ColorPicker — only set on open, not on every store update
  const pickerValueRef = useRef(initialColor);

  useEffect(() => {
    const justOpened = visible && !prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (justOpened) {
      // Lock the original color ONLY when first opening
      originalColorRef.current = initialColor;
      pickerValueRef.current = initialColor;
      setHexInput(initialColor);
      setCurrentColor(initialColor);
    }
  }, [initialColor, visible]);

  // onCompleteJS — finger lifted, final color
  const handleColorComplete = useCallback(({ hex }: { hex: string }) => {
    const normalized = hex.slice(0, 7);
    setCurrentColor(normalized);
    setHexInput(normalized);
    onComplete(normalized);
  }, [onComplete]);

  const handleHexSubmit = useCallback(() => {
    const cleaned = hexInput.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      setCurrentColor(cleaned);
      onComplete(cleaned);
    }
  }, [hexInput, onComplete]);

  const handleDone = useCallback(() => {
    const cleaned = currentColor.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      onComplete(cleaned);
    }
    onClose();
  }, [currentColor, onComplete, onClose]);

  const handleCancel = useCallback(() => {
    // Restore to original color
    const original = originalColorRef.current;
    onCancel?.(original);
    onClose();
  }, [onCancel, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <Pressable style={styles.backdrop} onPress={handleCancel} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Label */}
          {label && (
            <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
          )}

          {/* Color picker */}
          <ColorPicker
            style={styles.picker}
            value={pickerValueRef.current}
            onCompleteJS={handleColorComplete}
          >
            <Preview style={styles.preview} />
            <Panel1 style={styles.panel} />
            <HueSlider style={styles.slider} />
          </ColorPicker>

          {/* Hex input + original color swatch */}
          <View style={styles.hexRow}>
            <Text style={[styles.hexLabel, { color: colors.mutedForeground }]}>HEX</Text>
            <TextInput
              style={[
                styles.hexInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              value={hexInput}
              onChangeText={setHexInput}
              onSubmitEditing={handleHexSubmit}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
              placeholder="#000000"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={handleCancel}>
              <Text style={{ color: colors.foreground, fontWeight: fontWeight.medium }}>{t("common.cancel", "取消")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={handleDone}>
              <Text style={{ color: colors.primaryForeground, fontWeight: fontWeight.medium }}>{t("common.done", "完成")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetWrap: {
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: 32,
    gap: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textAlign: "center",
  },
  picker: {
    gap: 14,
  },
  preview: {
    height: 44,
    borderRadius: radius.md,
  },
  panel: {
    height: 180,
    borderRadius: radius.md,
  },
  slider: {
    height: 28,
    borderRadius: radius.md,
  },
  hexRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  hexLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    width: 36,
  },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: fontSize.base,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  doneBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
});
