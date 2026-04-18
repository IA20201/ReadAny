import { BookOpenIcon, MessageSquareIcon, NotebookPenIcon, UserIcon } from "@/components/ui/Icon";
import { ChatScreen } from "@/screens/ChatScreen";
import { LibraryScreen } from "@/screens/LibraryScreen";
import { NotesScreen } from "@/screens/NotesScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { useTheme } from "@/styles/ThemeContext";
/**
 * TabNavigator — bottom tab bar matching the Tauri mobile app's 4 tabs.
 * Icons: BookOpen, MessageSquare, NotebookPen, User (matching BottomTabBar.tsx)
 */
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type TabParamList = {
  Library: undefined;
  Chat: undefined;
  Notes: { bookId?: string } | undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Some Android devices (e.g. OnePlus Ace5 Ultra) underreport the bottom
  // safe area inset, causing tab bar labels to be clipped by the gesture
  // navigation bar. Ensure a minimum bottom inset so content stays visible.
  const bottomInset = Platform.OS === "android" ? Math.max(insets.bottom, 28) : insets.bottom;

  return (
    <Tab.Navigator
      safeAreaInsets={{ ...insets, bottom: bottomInset }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          paddingTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          tabBarLabel: t("tabs.library", "书架"),
          tabBarIcon: ({ color, size }) => <BookOpenIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: t("tabs.ai", "AI"),
          tabBarIcon: ({ color, size }) => <MessageSquareIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Notes"
        component={NotesScreen}
        options={{
          tabBarLabel: t("tabs.notes", "笔记"),
          tabBarIcon: ({ color, size }) => <NotebookPenIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t("tabs.profile", "我的"),
          tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
