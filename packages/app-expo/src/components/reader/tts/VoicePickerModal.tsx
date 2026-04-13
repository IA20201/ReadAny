import { useColors, radius } from "@/styles/theme";
import {
  DASHSCOPE_VOICES,
  EDGE_TTS_VOICES,
  type TTSConfig,
} from "@readany/core/tts";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { makeStyles } from "./tts-page-styles";

interface VoicePickerModalProps {
  visible: boolean;
  config: TTSConfig;
  onClose: () => void;
  onUpdateConfig: (updates: Partial<TTSConfig>) => void;
}

export function VoicePickerModal({
  visible,
  config,
  onClose,
  onUpdateConfig,
}: VoicePickerModalProps) {
  const colors = useColors();
  const s = makeStyles(colors);
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.voicePickerContainer}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={s.voicePickerSheet}>
          {/* Handle bar */}
          <View style={s.voicePickerHandle} />

          {/* Header */}
          <View style={s.voicePickerHeader}>
            <Text style={s.voicePickerTitle}>{t("tts.ttsEngine")}</Text>
          </View>

          {/* Engine selector */}
          <View style={s.engineSection}>
            {(["edge", "dashscope", "browser"] as const).map((eng) => {
              const isActive = config.engine === eng;
              const label =
                eng === "edge" ? "Edge TTS" : eng === "dashscope" ? "DashScope" : t("tts.browser");
              const desc =
                eng === "edge"
                  ? "Microsoft · 多语言"
                  : eng === "dashscope"
                    ? "阿里云通义 · 中文优化"
                    : "系统内置 · 免费";
              return (
                <TouchableOpacity
                  key={eng}
                  style={[s.engineRow, isActive && s.engineRowActive]}
                  onPress={() => onUpdateConfig({ engine: eng })}
                  activeOpacity={0.7}
                >
                  <View style={s.engineRowLeft}>
                    <Text style={[s.engineRowLabel, isActive && s.engineRowLabelActive]}>
                      {label}
                    </Text>
                    <Text style={s.engineRowDesc}>{desc}</Text>
                  </View>
                  {isActive && (
                    <View style={s.engineCheckmark}>
                      <Text style={s.engineCheckmarkTxt}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Divider + voice section title */}
          {config.engine !== "browser" && (
            <View style={s.voicePickerHeader}>
              <Text style={s.voicePickerTitle}>{t("tts.selectVoice")}</Text>
            </View>
          )}

          <ScrollView style={s.voicePickerList} showsVerticalScrollIndicator={false}>
            {/* DashScope voices */}
            {config.engine === "dashscope" &&
              DASHSCOPE_VOICES.map((v) => {
                const isSelected = config.dashscopeVoice === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[s.voiceItem, isSelected && s.voiceItemSelected]}
                    onPress={() => {
                      onUpdateConfig({ dashscopeVoice: v.id });
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.voiceItemTxt, isSelected && s.voiceItemTxtSelected]}>
                      {v.label}
                    </Text>
                    {isSelected && <Text style={s.voiceItemCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}

            {/* Edge TTS voices — grouped by language, zh-* first */}
            {config.engine === "edge" &&
              (() => {
                const grouped = EDGE_TTS_VOICES.reduce<Record<string, typeof EDGE_TTS_VOICES>>(
                  (acc, v) => {
                    (acc[v.lang] ??= []).push(v);
                    return acc;
                  },
                  {},
                );
                const langs = Object.keys(grouped).sort((a, b) => {
                  const aZh = a.startsWith("zh") ? -1 : 0;
                  const bZh = b.startsWith("zh") ? -1 : 0;
                  return aZh - bZh || a.localeCompare(b);
                });
                return langs.map((lang) => (
                  <View key={lang}>
                    <View style={s.voiceLangHeader}>
                      <Text style={s.voiceLangTxt}>{lang}</Text>
                    </View>
                    {grouped[lang]!.map((v) => {
                      const isSelected = config.edgeVoice === v.id;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[s.voiceItem, isSelected && s.voiceItemSelected]}
                          onPress={() => {
                            onUpdateConfig({ edgeVoice: v.id });
                            onClose();
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.voiceItemTxt, isSelected && s.voiceItemTxtSelected]}>
                            {v.name}
                          </Text>
                          {isSelected && <Text style={s.voiceItemCheck}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ));
              })()}

            {/* Browser — no selectable voices */}
            {config.engine === "browser" && (
              <View style={s.voiceBrowserNote}>
                <Text style={s.voiceBrowserNoteTxt}>{t("tts.browserVoiceNote")}</Text>
              </View>
            )}
          </ScrollView>

          {/* Cancel button */}
          <TouchableOpacity
            style={s.voicePickerCancel}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={s.voicePickerCancelTxt}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
