import { OnboardingNavigator } from "@/components/onboarding/OnboardingNavigator";
import { BookChatScreen } from "@/screens/BookChatScreen";
import { FullScreenNotesScreen } from "@/screens/FullScreenNotesScreen";
import { ReaderScreen } from "@/screens/ReaderScreen";
import SkillsScreen from "@/screens/SkillsScreen";
import StatsScreen from "@/screens/StatsScreen";
import AISettingsScreen from "@/screens/settings/AISettingsScreen";
import AboutScreen from "@/screens/settings/AboutScreen";
import AppearanceSettingsScreen from "@/screens/settings/AppearanceSettingsScreen";
import LanguageSettingsScreen from "@/screens/settings/LanguageSettingsScreen";
import SyncSettingsScreen from "@/screens/settings/SyncSettingsScreen";
import TTSSettingsScreen from "@/screens/settings/TTSSettingsScreen";
import TranslationSettingsScreen from "@/screens/settings/TranslationSettingsScreen";
import VectorModelSettingsScreen from "@/screens/settings/VectorModelSettingsScreen";
// Theme editor screens
import { ThemeEditorScreen } from "@/screens/settings/theme/ThemeEditorScreen";
import { ThemeColorEditorScreen } from "@/screens/settings/theme/ThemeColorEditorScreen";
import { ThemeTypographyScreen } from "@/screens/settings/theme/ThemeTypographyScreen";
import { ThemeBackgroundScreen } from "@/screens/settings/theme/ThemeBackgroundScreen";
import { ThemeIconsScreen } from "@/screens/settings/theme/ThemeIconsScreen";
import { ThemeShareScreen } from "@/screens/settings/theme/ThemeShareScreen";
/**
 * RootNavigator — top-level stack matching Tauri mobile App.tsx routes exactly.
 */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSettingsStore } from "@readany/core/stores/settings-store";
import { TabNavigator } from "./TabNavigator";

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  Reader: { bookId: string; cfi?: string; highlight?: boolean };
  BookChat: { bookId: string; selectedText?: string; chapterTitle?: string };
  Stats: undefined;
  Skills: undefined;
  VectorModelSettings: undefined;
  AppearanceSettings: undefined;
  LanguageSettings: undefined;
  AISettings: undefined;
  TTSSettings: undefined;
  TranslationSettings: undefined;
  SyncSettings: undefined;
  About: undefined;
  FullScreenNotes: { bookId: string };
  // Theme editor routes
  ThemeEditor: { themeId?: string };
  ThemeColorEditor: { themeId: string; mode: "light" | "dark" };
  ThemeTypography: { themeId: string };
  ThemeBackground: { themeId: string };
  ThemeIcons: { themeId: string };
  ThemeShare: { themeId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { hasCompletedOnboarding, _hasHydrated } = useSettingsStore();

  const showOnboarding = !hasCompletedOnboarding && _hasHydrated;

  if (!_hasHydrated) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen
            name="Reader"
            component={ReaderScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="BookChat"
            component={BookChatScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="Stats"
            component={StatsScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="Skills"
            component={SkillsScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="VectorModelSettings"
            component={VectorModelSettingsScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen name="AppearanceSettings" component={AppearanceSettingsScreen} />
          <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
          <Stack.Screen name="AISettings" component={AISettingsScreen} />
          <Stack.Screen name="TTSSettings" component={TTSSettingsScreen} />
          <Stack.Screen name="TranslationSettings" component={TranslationSettingsScreen} />
          <Stack.Screen name="SyncSettings" component={SyncSettingsScreen} />
          <Stack.Screen name="About" component={AboutScreen} />
          <Stack.Screen
            name="FullScreenNotes"
            component={FullScreenNotesScreen}
            options={{ animation: "slide_from_right" }}
          />
          {/* Theme editor screens */}
          <Stack.Screen
            name="ThemeEditor"
            component={ThemeEditorScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="ThemeColorEditor"
            component={ThemeColorEditorScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="ThemeTypography"
            component={ThemeTypographyScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="ThemeBackground"
            component={ThemeBackgroundScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="ThemeIcons"
            component={ThemeIconsScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="ThemeShare"
            component={ThemeShareScreen}
            options={{ animation: "slide_from_right" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
