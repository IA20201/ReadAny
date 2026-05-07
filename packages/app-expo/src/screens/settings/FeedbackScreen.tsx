/**
 * FeedbackScreen — Submit bug reports / feature requests and track history.
 * Submissions are sent to a Cloudflare Worker that creates GitHub Issues.
 */
import {
  collectDeviceInfo,
  collectLogs,
  getFeedbackHistory,
  getRemainingSubmissions,
  submitFeedback,
} from "@readany/core/feedback";
import type { DeviceInfo, FeedbackRecord, FeedbackType } from "@readany/core/feedback";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useColors } from "@/styles/theme";
import { SettingsHeader } from "./SettingsHeader";

const FEEDBACK_TYPES: { key: FeedbackType; label: string }[] = [
  { key: "bug", label: "Bug" },
  { key: "feature", label: "建议" },
  { key: "other", label: "其他" },
];

export default function FeedbackScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<"submit" | "history">("submit");

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <SettingsHeader title={t("feedback.title", "反馈建议")} />

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "submit" && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab("submit")}
        >
          <Text style={[styles.tabText, { color: activeTab === "submit" ? colors.primary : colors.mutedForeground }]}>
            {t("feedback.submitTab", "提交反馈")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab("history")}
        >
          <Text style={[styles.tabText, { color: activeTab === "history" ? colors.primary : colors.mutedForeground }]}>
            {t("feedback.historyTab", "我的反馈")}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "submit" ? (
        <SubmitTab colors={colors} t={t} />
      ) : (
        <HistoryTab colors={colors} t={t} />
      )}
    </SafeAreaView>
  );
}

// ─── Submit Tab ─────────────────────────────────────────────────────────────

function SubmitTab({ colors, t }: { colors: any; t: any }) {
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [includeLogs, setIncludeLogs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const remaining = getRemainingSubmissions();

  const deviceInfo: DeviceInfo = useMemo(
    () =>
      collectDeviceInfo({
        platform: Platform.OS as DeviceInfo["platform"],
        osVersion: `${Platform.OS} ${Platform.Version}`,
        appVersion: "1.2.1", // TODO: dynamic
        locale: "zh-CN",
      }),
    [],
  );

  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && remaining > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const logs = includeLogs ? collectLogs() : undefined;
      const result = await submitFeedback({
        type,
        title: title.trim(),
        description: description.trim(),
        contact: contact.trim() || undefined,
        includeLogs,
        deviceInfo,
        logs,
      });
      Alert.alert(
        t("feedback.submitSuccess", "提交成功"),
        t("feedback.submitSuccessDesc", "感谢你的反馈！Issue #{{number}} 已创建。", { number: result.issueNumber }),
        [{ text: t("common.ok", "好的") }],
      );
      setTitle("");
      setDescription("");
      setContact("");
      setIncludeLogs(false);
    } catch (err) {
      Alert.alert(
        t("feedback.submitFailed", "提交失败"),
        err instanceof Error ? err.message : "未知错误",
      );
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, submitting, type, title, description, contact, includeLogs, deviceInfo, t]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type selector */}
        <Text style={[styles.label, { color: colors.foreground }]}>{t("feedback.type", "类型")}</Text>
        <View style={styles.typeRow}>
          {FEEDBACK_TYPES.map((ft) => (
            <TouchableOpacity
              key={ft.key}
              style={[
                styles.typeBtn,
                { borderColor: type === ft.key ? colors.primary : colors.border },
                type === ft.key && { backgroundColor: `${colors.primary}15` },
              ]}
              onPress={() => setType(ft.key)}
            >
              <Text style={[styles.typeBtnText, { color: type === ft.key ? colors.primary : colors.foreground }]}>
                {ft.key === "bug" ? "🐛 Bug" : ft.key === "feature" ? "💡 " + ft.label : "📝 " + ft.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <Text style={[styles.label, { color: colors.foreground }]}>{t("feedback.titleLabel", "标题")} *</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
          placeholder={t("feedback.titlePlaceholder", "简要描述问题或建议")}
          placeholderTextColor={colors.mutedForeground}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* Description */}
        <Text style={[styles.label, { color: colors.foreground }]}>{t("feedback.descLabel", "详细描述")} *</Text>
        <TextInput
          style={[styles.textArea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
          placeholder={t("feedback.descPlaceholder", "请详细描述你遇到的问题或建议...")}
          placeholderTextColor={colors.mutedForeground}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        {/* Contact */}
        <Text style={[styles.label, { color: colors.foreground }]}>{t("feedback.contactLabel", "联系方式（选填）")}</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
          placeholder={t("feedback.contactPlaceholder", "邮箱或微信，方便我们联系你")}
          placeholderTextColor={colors.mutedForeground}
          value={contact}
          onChangeText={setContact}
          autoCapitalize="none"
        />

        {/* Upload logs */}
        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: colors.foreground, marginBottom: 0 }]}>
            {t("feedback.uploadLogs", "上传应用日志")}
          </Text>
          <Switch
            value={includeLogs}
            onValueChange={setIncludeLogs}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {t("feedback.logsHint", "日志有助于我们定位问题，不包含个人隐私信息")}
        </Text>

        {/* Device info preview */}
        <View style={[styles.deviceInfoBox, { backgroundColor: colors.muted }]}>
          <Text style={[styles.deviceInfoText, { color: colors.mutedForeground }]}>
            {deviceInfo.platform} {deviceInfo.osVersion} · v{deviceInfo.appVersion} · {deviceInfo.locale}
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: canSubmit ? colors.primary : colors.muted }]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>{t("feedback.submit", "提交反馈")}</Text>
          )}
        </TouchableOpacity>
        <Text style={[styles.remainingText, { color: colors.mutedForeground }]}>
          {t("feedback.remaining", "今日还可提交 {{count}} 次", { count: remaining })}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── History Tab ────────────────────────────────────────────────────────────

function HistoryTab({ colors, t }: { colors: any; t: any }) {
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeedbackHistory()
      .then(setRecords)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (records.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          {t("feedback.noHistory", "暂无反馈记录")}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={records}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.historyItem, { borderBottomColor: colors.border }]}
          onPress={() => Linking.openURL(item.issueUrl)}
          activeOpacity={0.7}
        >
          <View style={styles.historyLeft}>
            <Text style={[styles.historyTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>
              #{item.issueNumber} · {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: item.status === "open" ? `${colors.primary}20` : `${colors.mutedForeground}20` },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: item.status === "open" ? colors.primary : colors.mutedForeground },
              ]}
            >
              {item.status === "open" ? t("feedback.statusOpen", "处理中") : t("feedback.statusClosed", "已关闭")}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 14, fontWeight: "500" },
  scrollView: { flex: 1 },
  formContent: { padding: 16, gap: 4 },
  label: { fontSize: 13, fontWeight: "500", marginTop: 12, marginBottom: 6 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  typeBtnText: { fontSize: 13, fontWeight: "500" },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  hint: { fontSize: 11, marginTop: 4 },
  deviceInfoBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 6,
  },
  deviceInfoText: { fontSize: 11 },
  submitBtn: {
    marginTop: 20,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  remainingText: { fontSize: 11, textAlign: "center", marginTop: 8 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { fontSize: 14 },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  historyLeft: { flex: 1, marginRight: 12 },
  historyTitle: { fontSize: 14, fontWeight: "500" },
  historyMeta: { fontSize: 11, marginTop: 3 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: "500" },
});
