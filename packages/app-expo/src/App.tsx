/**
 * ReadAny Expo App — Root component
 *
 * Initialises platform service, i18n, and mounts navigation.
 */

// Polyfill AbortSignal.throwIfAborted — missing in Hermes, required by LangChain
if (typeof AbortSignal !== "undefined" && !AbortSignal.prototype.throwIfAborted) {
  AbortSignal.prototype.throwIfAborted = function () {
    if (this.aborted) {
      const err = this.reason ?? new Error("The operation was aborted.");
      throw err;
    }
  };
}

// Polyfill navigator.userAgent for LangChain — React Native doesn't have userAgent
if (typeof navigator !== "undefined" && !navigator.userAgent) {
  Object.defineProperty(navigator, "userAgent", {
    get: () => "ReactNative",
    configurable: true,
  });
}

import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View, ImageBackground, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { rnSessionEventSource } from "@/hooks";
import { useAppTheme } from "@/hooks/useAppTheme";
import { setStreamingFetch } from "@readany/core/ai/llm-provider";
import { initDatabase } from "@readany/core/db/database";
import { setSessionEventSource } from "@readany/core/hooks/use-reading-session";
import { i18nReady, initI18nLanguage } from "@readany/core/i18n";
import i18n from "@readany/core/i18n";
import { setPlatformService } from "@readany/core/services";
import { setSyncAdapter } from "@readany/core/sync";
import { useThemeStore } from "@readany/core/stores";
import { migrateFromLegacyTheme } from "@readany/core/theme/built-in-themes";
import { I18nextProvider } from "react-i18next";

import { ExpoPlatformService } from "@/lib/platform/expo-platform-service";
import { MobileSyncAdapter } from "@/lib/sync/sync-adapter-mobile";
import { UpdateDialog } from "@/components/update/UpdateDialog";
import { useUpdateChecker } from "@/hooks/use-update-checker";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useLibraryStore } from "@/stores/library-store";
import { useAutoSync } from "@readany/core/hooks/use-auto-sync";

/** Legacy SecureStore key used by the old ThemeContext */
const LEGACY_THEME_KEY = "readany-theme";

/**
 * One-time migration from the old ThemeContext (light/dark/sepia string)
 * to the new core theme store. Runs during bootstrap, before first render.
 */
async function migrateLegacyThemeIfNeeded() {
  try {
    const old = await SecureStore.getItemAsync(LEGACY_THEME_KEY);
    if (old && (old === "light" || old === "dark" || old === "sepia")) {
      const selection = migrateFromLegacyTheme(old);
      const store = useThemeStore.getState();
      store.setActiveTheme(selection.themeId, selection.preferredMode);
      // Remove legacy key so we don't re-migrate
      await SecureStore.deleteItemAsync(LEGACY_THEME_KEY);
    }
  } catch {
    // Non-critical — if migration fails, user gets default (Classic auto)
  }
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      // 1. Register platform service
      const platform = new ExpoPlatformService();
      setPlatformService(platform);

      // 2. Register sync adapter
      setSyncAdapter(new MobileSyncAdapter());

      // 3. Initialize database (create tables)
      await initDatabase();

      // 4. Wait for i18n to be ready
      try {
        await i18nReady;
        console.log("[App] i18n initialized successfully");
      } catch (error) {
        console.error("[App] i18n initialization failed:", error);
        // Continue anyway, i18n will use default language
      }

      // 5. Register RN-specific adapters
      setSessionEventSource(rnSessionEventSource);

      // 6. Restore persisted language
      await initI18nLanguage();

      // 7. Inject streaming-compatible fetch for AI calls
      const { fetch: expoFetch } = await import("expo/fetch");
      setStreamingFetch(expoFetch as typeof globalThis.fetch);

      // Note: Mobile app only supports remote embedding APIs (OpenAI, DeepSeek, etc.)
      // Local embedding is not supported to reduce APK size by ~100MB

      // 9. Migrate legacy theme selection (one-time)
      await migrateLegacyThemeIfNeeded();

      setReady(true);
    }
    bootstrap();
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#1c1c1e",
        }}
      >
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <AppInner />
    </I18nextProvider>
  );
}

function AppInner() {
  const { colors, isDark, mode } = useAppTheme();
  const loadBooks = useLibraryStore((s) => s.loadBooks);
  useUpdateChecker();
  useAutoSync(loadBooks);

  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.background,
        card: colors.card,
        text: colors.foreground,
        border: colors.border,
        primary: colors.primary,
      },
    }),
    [colors, isDark],
  );

  const content = (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <RootNavigator />
      </NavigationContainer>
      <UpdateDialog />
    </SafeAreaProvider>
  );

  if (colors.backgroundImage) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ImageBackground
          source={{ uri: colors.backgroundImage }}
          style={{ flex: 1 }}
          resizeMode="cover"
        >
          {content}
        </ImageBackground>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      {content}
    </GestureHandlerRootView>
  );
}
