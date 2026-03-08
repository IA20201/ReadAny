import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useTTSStore } from "@readany/core/stores";
import {
  DASHSCOPE_VOICES,
  EDGE_TTS_VOICES,
  type TTSEngine,
} from "@readany/core/tts";
import { ArrowLeft, Volume2, Zap, Globe, Mic, Play } from "lucide-react";
import { useKeyboardAwareScroll } from "@/lib/use-keyboard-aware-scroll";

const ENGINES: { id: TTSEngine; labelKey: string; icon: typeof Volume2 }[] = [
  { id: "edge", labelKey: "tts.edgeEngine", icon: Globe },
  { id: "browser", labelKey: "tts.browser", icon: Volume2 },
  { id: "dashscope", labelKey: "tts.tongyi", icon: Zap },
];

export function TTSSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { config, updateConfig, play, stop } = useTTSStore();
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  useKeyboardAwareScroll(scrollRef);

  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length) setBrowserVoices(voices);
    };
    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // Group edge voices by language
  const edgeVoiceGroups = useMemo(() => {
    const groups: Record<string, typeof EDGE_TTS_VOICES> = {};
    for (const v of EDGE_TTS_VOICES) {
      const lang = v.lang;
      if (!groups[lang]) groups[lang] = [];
      groups[lang].push(v);
    }
    // Prioritize Chinese
    const sorted = Object.entries(groups).sort(([a], [b]) => {
      if (a.startsWith("zh")) return -1;
      if (b.startsWith("zh")) return 1;
      if (a.startsWith("en")) return -1;
      if (b.startsWith("en")) return 1;
      return a.localeCompare(b);
    });
    return sorted;
  }, []);

  const handlePreview = useCallback(() => {
    stop();
    setTimeout(() => play(t("tts.testText")), 100);
  }, [play, stop]);

  return (
    <div className="flex h-full flex-col bg-background">
      <header
        className="shrink-0 flex items-center gap-3 px-4 pb-3 border-b border-border bg-background"
        style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}
      >
        <button type="button" className="p-1 -ml-1" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-lg font-semibold">{t("tts.title")}</h1>
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm text-primary active:opacity-70"
          onClick={handlePreview}
        >
          <Play className="h-4 w-4" />
          {t("common.preview")}
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Engine Selection */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t("tts.ttsEngine")}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {ENGINES.map((eng) => {
              const Icon = eng.icon;
              const active = config.engine === eng.id;
              return (
                <button
                  key={eng.id}
                  type="button"
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card active:bg-accent"
                    }`}
                  onClick={() => updateConfig({ engine: eng.id })}
                >
                  <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-xs ${active ? "font-medium text-primary" : ""}`}>
                    {t(eng.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Voice Selection */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t("tts.voiceSelect")}
          </h2>

          {config.engine === "edge" && (
            <div className="rounded-xl bg-card border border-border overflow-hidden max-h-60 overflow-y-auto">
              {edgeVoiceGroups.map(([lang, voices]) => (
                <div key={lang}>
                  <div className="sticky top-0 bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {lang}
                  </div>
                  {voices.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-sm active:bg-accent transition-colors ${config.edgeVoice === v.id ? "text-primary font-medium" : ""
                        }`}
                      onClick={() => updateConfig({ edgeVoice: v.id })}
                    >
                      <span>{v.name}</span>
                      {config.edgeVoice === v.id && (
                        <Mic className="h-3.5 w-3.5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {config.engine === "browser" && (
            <div className="rounded-xl bg-card border border-border overflow-hidden max-h-60 overflow-y-auto">
              {browserVoices.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {t("tts.noSystemVoices")}
                </p>
              ) : (
                browserVoices.map((v) => (
                  <button
                    key={v.voiceURI}
                    type="button"
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-sm active:bg-accent transition-colors ${config.voiceName === v.name ? "text-primary font-medium" : ""
                      }`}
                    onClick={() => updateConfig({ voiceName: v.name })}
                  >
                    <span>
                      {v.name} <span className="text-xs text-muted-foreground">({v.lang})</span>
                    </span>
                    {config.voiceName === v.name && (
                      <Mic className="h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {config.engine === "dashscope" && (
            <>
              <div className="rounded-xl bg-card border border-border overflow-hidden max-h-60 overflow-y-auto">
                {DASHSCOPE_VOICES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-sm active:bg-accent transition-colors ${config.dashscopeVoice === v.id ? "text-primary font-medium" : ""
                      }`}
                    onClick={() => updateConfig({ dashscopeVoice: v.id })}
                  >
                    <span>
                      {v.label} <span className="text-xs text-muted-foreground">{v.id}</span>
                    </span>
                    {config.dashscopeVoice === v.id && (
                      <Mic className="h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                ))}
              </div>

              {/* DashScope API Key */}
              <div className="mt-3">
                <label className="mb-1.5 block text-xs text-muted-foreground">
                  {t("tts.apiKey")}
                </label>
                <input
                  className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  type="password"
                  value={config.dashscopeApiKey || ""}
                  onChange={(e) => updateConfig({ dashscopeApiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </div>
            </>
          )}
        </section>

        {/* Rate & Pitch */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t("tts.params")}
          </h2>

          <div className="rounded-xl bg-card border border-border p-4 space-y-4">
            {/* Rate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">{t("tts.rate")}</span>
                <span className="text-sm font-mono text-muted-foreground">{config.rate.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={config.rate}
                onChange={(e) => updateConfig({ rate: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>

            {/* Pitch (browser only) */}
            {config.engine === "browser" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">{t("tts.pitch")}</span>
                  <span className="text-sm font-mono text-muted-foreground">{config.pitch.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={config.pitch}
                  onChange={(e) => updateConfig({ pitch: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
