import { decodeConfig, encodeConfig } from "@readany/core/utils";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import { memo, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { fontSize, fontWeight, radius, useColors } from "../../styles/theme";

interface ConfigTransferProps {
  getData: () => unknown;
  applyData: (data: unknown) => void;
  validate: (data: unknown) => boolean;
  label: string;
}

export const ConfigTransfer = memo(function ConfigTransfer({
  getData,
  applyData,
  validate,
  label,
}: ConfigTransferProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"idle" | "export" | "import" | "scan">("idle");
  const [token, setToken] = useState("");
  const [importText, setImportText] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const scannerHandledRef = useRef(false);
  const [scannerLocked, setScannerLocked] = useState(false);

  const handleExport = useCallback(() => {
    try {
      const data = getData();
      const encoded = encodeConfig(data);
      setToken(encoded);
      setMode("export");
    } catch {
      Alert.alert(t("common.error", "错误"), t("settings.exportFailed", "导出失败，数据可能过大"));
    }
  }, [getData, t]);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(token);
    Alert.alert(t("common.copied", "已复制"), t("settings.copiedToClipboard", "口令已复制到剪贴板"));
  }, [token, t]);

  const applyImportedData = useCallback(
    (raw: string) => {
      const data = decodeConfig(raw.trim());
      if (!data || !validate(data)) {
        Alert.alert(t("common.error", "错误"), t("settings.invalidConfig", "配置格式无效"));
        return;
      }
      applyData(data);
      Alert.alert(t("common.success", "成功"), t("settings.configImported", "配置已导入"));
      setMode("idle");
      setImportText("");
    },
    [validate, applyData, t],
  );

  const handleImport = useCallback(() => applyImportedData(importText), [importText, applyImportedData]);

  const handlePaste = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setImportText(text);
  }, []);

  const handleStartScan = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(t("common.error", "错误"), t("settings.cameraPermissionDenied", "需要相机权限才能扫描二维码"));
        return;
      }
    }
    scannerHandledRef.current = false;
    setScannerLocked(false);
    setMode("scan");
  }, [permission, requestPermission, t]);

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scannerHandledRef.current) return;
      scannerHandledRef.current = true;
      setScannerLocked(true);
      setMode("idle");
      applyImportedData(data);
    },
    [applyImportedData],
  );

  if (mode === "export") {
    const canShowQR = token.length <= 2900;
    return (
      <View
        style={{
          alignItems: "center",
          gap: 12,
          padding: 16,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.muted + "40",
        }}
      >
        {canShowQR ? (
          <View style={{ padding: 12, borderRadius: radius.md, backgroundColor: "#fff" }}>
            <QRCode value={token} size={160} />
          </View>
        ) : null}
        <Text style={{ fontSize: fontSize.xs, color: colors.mutedForeground, textAlign: "center" }}>
          {canShowQR
            ? t("settings.scanOrCopy", "扫描二维码或复制口令，在另一台设备导入")
            : t("settings.copyToken", "数据较大，请复制口令后在另一台设备导入")}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
          <TouchableOpacity
            onPress={handleCopy}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.foreground, fontWeight: fontWeight.medium }}>
              {t("common.copy", "复制口令")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode("idle")}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: radius.md,
              backgroundColor: colors.muted,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground }}>
              {t("common.cancel", "取消")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mode === "scan") {
    return (
      <View
        style={{
          overflow: "hidden",
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <CameraView
          style={{ width: "100%", height: 280 }}
          facing="back"
          onBarcodeScanned={!scannerLocked ? onBarcodeScanned : undefined}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
        <TouchableOpacity
          onPress={() => { setMode("idle"); setScannerLocked(false); }}
          style={{
            paddingVertical: 10,
            backgroundColor: colors.muted,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground }}>
            {t("common.cancel", "取消")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === "import") {
    return (
      <View
        style={{
          gap: 12,
          padding: 16,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.muted + "40",
        }}
      >
        <TextInput
          placeholder={t("settings.pasteConfig", "粘贴配置口令...")}
          placeholderTextColor={colors.mutedForeground}
          value={importText}
          onChangeText={setImportText}
          multiline
          style={{
            minHeight: 80,
            padding: 12,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            color: colors.foreground,
            fontSize: fontSize.xs,
            fontFamily: "monospace",
            textAlignVertical: "top",
          }}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={handlePaste}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.foreground }}>
              {t("common.paste", "粘贴")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleImport}
            disabled={!importText.trim()}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              alignItems: "center",
              opacity: importText.trim() ? 1 : 0.5,
            }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.primaryForeground, fontWeight: fontWeight.medium }}>
              {t("settings.importConfig", "导入")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setMode("idle"); setImportText(""); }}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: radius.md,
              backgroundColor: colors.muted,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.mutedForeground }}>
              {t("common.cancel", "取消")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          onPress={handleExport}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: fontSize.sm, color: colors.foreground }}>
            {t("settings.exportConfig", "导出")} {label}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMode("import")}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: fontSize.sm, color: colors.foreground }}>
            {t("settings.importConfig", "导入")} {label}
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={handleStartScan}
        style={{
          paddingVertical: 10,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: fontSize.sm, color: colors.foreground }}>
          {t("settings.scanQRCode", "扫码导入")}
        </Text>
      </TouchableOpacity>
    </View>
  );
});
