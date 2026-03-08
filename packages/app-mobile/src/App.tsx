import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { LibraryPage } from "@/components/library/LibraryPage";
import { ChatPage } from "@/components/chat/ChatPage";
import { NotesPage } from "@/components/notes/NotesPage";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { MobileReaderView } from "@/components/reader/MobileReaderView";
import { SkillsPage } from "@/components/skills/SkillsPage";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { AISettingsPage } from "@/components/settings/AISettingsPage";
import { TTSSettingsPage } from "@/components/settings/TTSSettingsPage";
import { TranslationSettingsPage } from "@/components/settings/TranslationSettingsPage";
import { AboutPage } from "@/components/settings/AboutPage";
import { VectorModelSettingsPage } from "@/components/settings/VectorModelSettingsPage";
import { SyncSettingsPage } from "@/components/settings/SyncSettingsPage";
import { MobileStatsPage } from "@/components/stats/MobileStatsPage";
import { useSyncEvents, useAutoSync } from "@/hooks/use-sync";

function AppContent() {
  useSyncEvents();
  useAutoSync();

  return (
    <>
      <Routes>
        {/* Tab layout */}
        <Route element={<MobileLayout />}>
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        {/* Reader — full screen, no tab bar */}
        <Route path="/reader/:bookId" element={<MobileReaderView />} />

        {/* Settings sub-pages — full screen, no tab bar */}
        <Route path="/settings/appearance" element={<AppearanceSettings />} />
        <Route path="/settings/ai" element={<AISettingsPage />} />
        <Route path="/settings/tts" element={<TTSSettingsPage />} />
        <Route path="/settings/translation" element={<TranslationSettingsPage />} />
        <Route path="/settings/sync" element={<SyncSettingsPage />} />
        <Route path="/settings/about" element={<AboutPage />} />
        <Route path="/settings/vector-model" element={<VectorModelSettingsPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/stats" element={<MobileStatsPage />} />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Routes>

      <Toaster position="top-center" richColors duration={2000} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
