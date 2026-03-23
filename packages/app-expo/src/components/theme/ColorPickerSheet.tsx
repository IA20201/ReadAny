/**
 * ColorPickerSheet — bottom-sheet modal with HSV color picker + hex input.
 *
 * Uses `reanimated-color-picker` for the visual picker.
 * Writes the final color on `onComplete` to avoid excessive store writes during drag.
 */
import { useCallback, useEffect, useState } from "react";
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
  OpacitySlider,
} from "reanimated-color-picker";
import { useColors } from "@/styles/theme";
import { fontSize, fontWeight, radius, spacing } from "@/styles/theme";

interface Props {
  visible: boolean;
  initialColor: string;
  onComplete: (hex: string) => void;
  onClose: () => void;
  label?: string;
}

export function ColorPickerSheet({ visible, initialColor, onComplete, onClose, label }: Props) {
  const colors = useColors();
  const [hexInput, setHexInput] = useState(initialColor);
  const [currentColor, setCurrentColor] = useState(initialColor);

  useEffect(() => {
    setHexInput(initialColor);
    setCurrentColor(initialColor);
  }, [initialColor]);

  const handleColorChange = useCallback(({ hex }: { hex: string }) => {
    const normalized = hex.slice(0, 7); // strip alpha if present
    setCurrentColor(normalized);
    setHexInput(normalized);
  }, []);

  const handleHexSubmit = useCallback(() => {
    const cleaned = hexInput.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      setCurrentColor(cleaned);
    }
  }, [hexInput]);

  const handleDone = useCallback(() => {
    const cleaned = currentColor.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      onComplete(cleaned);
    }
    onClose();
  }, [currentColor, onComplete, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
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
            value={initialColor}
            onComplete={handleColorChange}
          >
            <Preview style={styles.preview} />
            <Panel1 style={styles.panel} />
            <HueSlider style={styles.slider} />
          </ColorPicker>

          {/* Hex input */}
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
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={{ color: colors.foreground, fontWeight: fontWeight.medium }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={handleDone}>
              <Text style={{ color: colors.primaryForeground, fontWeight: fontWeight.medium }}>Done</Text>
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
    gap: 16,
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
    gap: 16,
  },
  preview: {
    height: 40,
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
