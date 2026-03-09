/**
 * ChatScreen — placeholder for AI chat (not available in RN yet)
 */
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useColors } from "@/styles/theme";

export function ChatScreen() {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t("chat.title")}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          AI Chat 功能暂未在 React Native 版本中实现
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
  },
});
