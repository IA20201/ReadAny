import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useThemeStore } from "@readany/core/stores";
import { applyThemeToDOM } from "@readany/core/theme";
import type { ThemeConfig } from "@readany/core/types";
import { Check, Moon, Monitor, Sun } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { OnboardingLayout } from "../OnboardingLayout";

type PreferredMode = "light" | "dark" | "auto";

const MODE_OPTIONS: { mode: PreferredMode; icon: typeof Sun; labelKey: string }[] = [
  { mode: "light", icon: Sun, labelKey: "theme.lightMode" },
  { mode: "dark", icon: Moon, labelKey: "theme.darkMode" },
  { mode: "auto", icon: Monitor, labelKey: "theme.autoMode" },
];

export function AppearancePage({ onNext, onPrev, step, totalSteps }: any) {
  const { t, i18n } = useTranslation();
  const themes = useThemeStore((s) => s.themes);
  const activeSelection = useThemeStore((s) => s.activeSelection);
  const setActiveTheme = useThemeStore((s) => s.setActiveTheme);
  const setPreferredMode = useThemeStore((s) => s.setPreferredMode);
  const getActiveTheme = useThemeStore((s) => s.getActiveTheme);
  const getActiveMode = useThemeStore((s) => s.getActiveMode);

  const applyCurrentTheme = useCallback(() => {
    const theme = getActiveTheme();
    const mode = getActiveMode();
    applyThemeToDOM(theme, mode);
  }, [getActiveTheme, getActiveMode]);

  const handleSelectTheme = useCallback(
    (theme: ThemeConfig) => {
      setActiveTheme(theme.id);
      requestAnimationFrame(() => applyCurrentTheme());
    },
    [setActiveTheme, applyCurrentTheme],
  );

  const handleSelectMode = useCallback(
    (mode: PreferredMode) => {
      setPreferredMode(mode);
      requestAnimationFrame(() => applyCurrentTheme());
    },
    [setPreferredMode, applyCurrentTheme],
  );

  const handleLanguageChange = async (lang: string) => {
    const { changeAndPersistLanguage } = await import("@readany/core/i18n");
    await changeAndPersistLanguage(lang);
  };

  return (
    <OnboardingLayout
      illustration="/illustrations/smiling_girl.svg"
      step={step}
      totalSteps={totalSteps}
      footer={
        <>
          <Button variant="ghost" onClick={onPrev}>
            {t("common.back", "Back")}
          </Button>
          <Button onClick={onNext} size="lg" className="rounded-full px-8 shadow-md">
            {t("common.next", "Next")} →
          </Button>
        </>
      }
    >
      <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col justify-center">
        <div className="space-y-2 text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight">
            {t("onboarding.appearance.title", "Appearance & Language")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("onboarding.appearance.desc", "Customize ReadAny to suit your preferences.")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Theme + Mode Selection */}
          <div className="rounded-xl border bg-muted/30 p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-medium text-foreground uppercase tracking-wide">
              {t("settings.theme", "Theme")}
            </h3>
            <div className="space-y-3">
              {/* Theme cards */}
              <div className="grid grid-cols-2 gap-2">
                {themes.map((theme) => {
                  const isActive = activeSelection.themeId === theme.id;
                  const previewMode = theme.modes.light ? "light" : "dark";
                  const colors = theme.modes[previewMode]!;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => handleSelectTheme(theme)}
                      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-lg border py-3 transition-all duration-300 ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-muted"
                      }`}
                    >
                      <div className="flex gap-1">
                        <div className="h-4 w-4 rounded-full border border-black/10" style={{ background: colors.background }} />
                        <div className="h-4 w-4 rounded-full border border-black/10" style={{ background: colors.primary }} />
                      </div>
                      <span className="text-xs font-medium">
                        {theme.builtIn ? t(`theme.${theme.id === "builtin-classic" ? "classic" : "eyeCare"}` as any) : theme.name}
                      </span>
                      {isActive && <Check className="absolute right-1 top-1 h-3 w-3 text-primary" />}
                    </button>
                  );
                })}
              </div>
              {/* Mode toggle */}
              <div className="flex gap-1.5">
                {MODE_OPTIONS.map(({ mode, icon: Icon, labelKey }) => {
                  const isActive = activeSelection.preferredMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => handleSelectMode(mode)}
                      className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t(labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Language */}
          <div className="rounded-xl border bg-muted/30 p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-medium text-foreground uppercase tracking-wide">
              {t("settings.language", "Language")}
            </h3>
            <Select value={i18n.language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="h-10 rounded-lg font-medium text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh">{t("settings.simplifiedChinese", "中文")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}
