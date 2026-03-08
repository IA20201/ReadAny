import { useRef } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@readany/core/stores";
import {
  TRANSLATOR_PROVIDERS,
  TRANSLATOR_LANGS,
  type TranslationTargetLang,
} from "@readany/core/types/translation";
import { ArrowLeft, Check } from "lucide-react";
import { useKeyboardAwareScroll } from "@/lib/use-keyboard-aware-scroll";

export function TranslationSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { translationConfig, updateTranslationConfig, aiConfig } =
    useSettingsStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  useKeyboardAwareScroll(scrollRef);

  return (
    <div className="flex h-full flex-col bg-background">
      <header
        className="shrink-0 flex items-center gap-3 px-4 pb-3 border-b border-border bg-background"
        style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}
      >
        <button type="button" className="p-1 -ml-1" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">{t("translation.settingsTitle")}</h1>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Provider */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t("translation.engine")}
          </h2>
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            {TRANSLATOR_PROVIDERS.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full items-center justify-between px-4 py-3.5 active:bg-accent transition-colors"
                style={
                  idx < TRANSLATOR_PROVIDERS.length - 1
                    ? { borderBottom: "1px solid var(--border)" }
                    : undefined
                }
                onClick={() =>
                  updateTranslationConfig({
                    provider: { id: p.id, name: p.name },
                  })
                }
              >
                <div>
                  <span className="text-base">{p.name}</span>
                  {p.id === "ai" && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t("translation.useAIModel", { model: aiConfig.activeModel || "AI" })}
                    </span>
                  )}
                </div>
                {translationConfig.provider.id === p.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* DeepL API Key */}
        {translationConfig.provider.id === "deepl" && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t("translation.deeplApiKey")}
            </h2>
            <input
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              type="password"
              value={translationConfig.provider.apiKey || ""}
              onChange={(e) =>
                updateTranslationConfig({
                  provider: { ...translationConfig.provider, apiKey: e.target.value },
                })
              }
              placeholder={t("translation.deeplApiKeyPlaceholder")}
            />
          </section>
        )}

        {/* Target Language */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t("translation.targetLanguage")}
          </h2>
          <div className="rounded-xl bg-card border border-border overflow-hidden max-h-80 overflow-y-auto">
            {Object.entries(TRANSLATOR_LANGS).map(([code, name]) => (
              <button
                key={code}
                type="button"
                className={`flex w-full items-center justify-between px-4 py-3 active:bg-accent transition-colors ${translationConfig.targetLang === code
                    ? "text-primary font-medium"
                    : ""
                  }`}
                onClick={() => updateTranslationConfig({ targetLang: code as TranslationTargetLang })}
              >
                <span className="text-sm">{name}</span>
                {translationConfig.targetLang === code && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
