import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@readany/core/stores";
import type { AIEndpoint, AIProviderType } from "@readany/core/types";
import {
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useKeyboardAwareScroll } from "@/lib/use-keyboard-aware-scroll";

const PROVIDERS: { id: AIProviderType; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google" },
  { id: "deepseek", label: "DeepSeek" },
];

export function AISettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    aiConfig,
    addEndpoint,
    updateEndpoint,
    removeEndpoint,
    setActiveEndpoint,
    setActiveModel,
    updateAIConfig,
    fetchModels,
  } = useSettingsStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newModelInput, setNewModelInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useKeyboardAwareScroll(scrollRef);

  const handleAddEndpoint = useCallback(() => {
    addEndpoint({
      id: crypto.randomUUID(),
      name: t("settings.ai_newEndpoint"),
      provider: "openai",
      apiKey: "",
      baseUrl: "https://api.openai.com/v1",
      models: [],
      modelsFetched: false,
    });
  }, [addEndpoint]);

  const handleFetchModels = useCallback(
    async (ep: AIEndpoint) => {
      updateEndpoint(ep.id, { modelsFetching: true });
      try {
        await fetchModels(ep.id);
      } catch (err) {
        console.error("Failed to fetch models:", err);
      }
    },
    [fetchModels, updateEndpoint],
  );

  const handleAddManualModel = useCallback(
    (endpointId: string, models: string[]) => {
      const trimmed = newModelInput.trim();
      if (!trimmed || models.includes(trimmed)) return;
      updateEndpoint(endpointId, { models: [...models, trimmed] });
      setNewModelInput("");
    },
    [newModelInput, updateEndpoint],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <header
        className="shrink-0 flex items-center gap-3 px-4 pb-3 border-b border-border bg-background"
        style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}
      >
        <button type="button" className="p-1 -ml-1" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-lg font-semibold">{t("settings.ai_title")}</h1>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground active:scale-95 transition-transform"
          onClick={handleAddEndpoint}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("common.add")}
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Endpoints */}
        {aiConfig.endpoints.map((ep) => {
          const isActive = ep.id === aiConfig.activeEndpointId;
          const isExpanded = expandedId === ep.id;

          return (
            <div
              key={ep.id}
              className={`rounded-xl border overflow-hidden transition-colors ${isActive ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                }`}
            >
              {/* Header */}
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3.5 active:bg-accent/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : ep.id)}
              >
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium">{ep.name || t("common.unnamed")}</span>
                    {isActive && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {t("common.current")}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{ep.provider}</span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-4 space-y-4">
                  {/* Active toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t("settings.ai_setDefault")}</span>
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => setActiveEndpoint(ep.id)}
                    />
                  </div>

                  {/* Name */}
                  <div>
                    <label className="mb-1.5 block text-xs text-muted-foreground">{t("settings.ai_name")}</label>
                    <input
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={ep.name}
                      onChange={(e) => updateEndpoint(ep.id, { name: e.target.value })}
                    />
                  </div>

                  {/* Provider */}
                  <div>
                    <label className="mb-1.5 block text-xs text-muted-foreground">{t("settings.ai_providerLabel")}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PROVIDERS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`rounded-lg border px-3 py-2 text-sm transition-colors ${ep.provider === p.id
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border bg-background active:bg-accent"
                            }`}
                          onClick={() => updateEndpoint(ep.id, { provider: p.id })}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="mb-1.5 block text-xs text-muted-foreground">{t("settings.ai_apiKey")}</label>
                    <input
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      type="password"
                      value={ep.apiKey}
                      onChange={(e) => updateEndpoint(ep.id, { apiKey: e.target.value })}
                      placeholder="sk-..."
                    />
                  </div>

                  {/* Base URL */}
                  <div>
                    <label className="mb-1.5 block text-xs text-muted-foreground">{t("settings.ai_baseUrl")}</label>
                    <input
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={ep.baseUrl}
                      onChange={(e) => updateEndpoint(ep.id, { baseUrl: e.target.value })}
                    />
                  </div>

                  {/* Models */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">{t("settings.ai_modelsList")}</label>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-primary active:opacity-70"
                        onClick={() => handleFetchModels(ep)}
                        disabled={!!ep.modelsFetching}
                      >
                        {ep.modelsFetching ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        {t("settings.ai_fetchModels")}
                      </button>
                    </div>

                    {/* Model tags */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {ep.models.map((m) => (
                        <span
                          key={m}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${aiConfig.activeModel === m && isActive
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted"
                            }`}
                        >
                          <button
                            type="button"
                            className="text-left flex-1"
                            onClick={() => {
                              setActiveEndpoint(ep.id);
                              setActiveModel(m);
                            }}
                          >
                            {m}
                          </button>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              updateEndpoint(ep.id, {
                                models: ep.models.filter((x) => x !== m),
                              })
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Add model input */}
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                        placeholder={t("settings.ai_addManualModelPlaceholder")}
                        value={newModelInput}
                        onChange={(e) => setNewModelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddManualModel(ep.id, ep.models);
                        }}
                      />
                      <button
                        type="button"
                        className="rounded-lg bg-primary px-3 text-sm text-primary-foreground active:scale-95"
                        onClick={() => handleAddManualModel(ep.id, ep.models)}
                      >
                        {t("common.add")}
                      </button>
                    </div>
                  </div>

                  {/* Delete */}
                  {aiConfig.endpoints.length > 1 && (
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 py-2.5 text-sm text-destructive active:bg-destructive/10 transition-colors"
                      onClick={() => removeEndpoint(ep.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("settings.ai_deleteEndpoint")}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Global Params */}
        <section className="rounded-xl bg-card border border-border p-4 space-y-4">
          <h2 className="text-sm font-medium">{t("settings.ai_globalParams")}</h2>

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{t("settings.ai_temperature")}</span>
              <span className="text-sm font-mono">{aiConfig.temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={aiConfig.temperature}
              onChange={(e) => updateAIConfig({ temperature: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          {/* Max Tokens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{t("settings.ai_maxTokens")}</span>
              <span className="text-sm font-mono">{aiConfig.maxTokens}</span>
            </div>
            <input
              type="range"
              min={1024}
              max={32768}
              step={1024}
              value={aiConfig.maxTokens}
              onChange={(e) => updateAIConfig({ maxTokens: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          {/* Context Window */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{t("settings.ai_contextWindow")}</span>
              <span className="text-sm font-mono">{aiConfig.slidingWindowSize} {t("settings.ai_contextWindowUnit")}</span>
            </div>
            <input
              type="range"
              min={2}
              max={30}
              step={1}
              value={aiConfig.slidingWindowSize}
              onChange={(e) => updateAIConfig({ slidingWindowSize: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
