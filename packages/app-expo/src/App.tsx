/**
 * ReadAny Expo App — Root component
 *
 * Initialises platform service, i18n, and mounts navigation.
 */
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import { setPlatformService } from "@readany/core/services";
import { initI18nLanguage } from "@readany/core/i18n";
import { setSessionEventSource } from "@readany/core/hooks";
import { setTTSPlayerFactories } from "@readany/core/stores";

import { ExpoPlatformService } from "@/lib/platform/expo-platform-service";
import { rnSessionEventSource } from "@/lib/platform/rn-session-events";
import { rnTTSPlayerFactories } from "@/lib/platform/rn-tts-factories";
import { RootNavigator } from "@/navigation/RootNavigator";
import { ThemeProvider, useTheme } from "@/styles/ThemeContext";

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      // 1. Register platform service
      const platform = new ExpoPlatformService();
      setPlatformService(platform);

      // 2. Register RN-specific adapters
      setSessionEventSource(rnSessionEventSource);
      setTTSPlayerFactories(rnTTSPlayerFactories);

      // 3. Restore persisted language
      await initI18nLanguage();

      setReady(true);
    }
    bootstrap();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

function AppInner() {
  const { colors, isDark, mode } = useTheme();

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

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style={mode === "dark" ? "light" : "dark"} />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
