import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Sun, Moon, BookOpen, Check } from "lucide-react";

const THEMES = [
  { id: "light", labelKey: "settings.light", icon: Sun },
  { id: "dark", labelKey: "settings.dark", icon: Moon },
  { id: "sepia", labelKey: "settings.sepia", icon: BookOpen },
] as const;

const LANGUAGES = [
  { code: "zh", label: "简体中文" },
  { code: "en", label: "English" },
] as const;

export function AppearanceSettings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState(() => localStorage.getItem("readany-theme") || "light");
  const [lang, setLang] = useState(() => i18n.language?.startsWith("zh") ? "zh" : "en");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("readany-theme", theme);
  }, [theme]);

  const handleLangChange = useCallback(
    async (code: string) => {
      setLang(code);
      const { changeAndPersistLanguage } = await import("@readany/core/i18n");
      await changeAndPersistLanguage(code);
    },
    [],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header
        className="shrink-0 flex items-center gap-3 px-4 pb-3 border-b border-border bg-background"
        style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}
      >
        <button type="button" className="p-1 -ml-1" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">{t("settings.appearance")}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Theme */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t("settings.theme")}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map((themeItem) => {
              const Icon = themeItem.icon;
              const active = theme === themeItem.id;
              return (
                <button
                  key={themeItem.id}
                  type="button"
                  className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card active:bg-accent"
                  }`}
                  onClick={() => setTheme(themeItem.id)}
                >
                  <Icon className={`h-6 w-6 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm ${active ? "font-medium text-primary" : "text-foreground"}`}>
                    {t(themeItem.labelKey)}
                  </span>
                  {active && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Language */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t("settings.language")}
          </h2>
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            {LANGUAGES.map((l, idx) => (
              <button
                key={l.code}
                type="button"
                className="flex w-full items-center justify-between px-4 py-3.5 active:bg-accent transition-colors"
                style={idx < LANGUAGES.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                onClick={() => handleLangChange(l.code)}
              >
                <span className="text-base">{l.label}</span>
                {lang === l.code && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
