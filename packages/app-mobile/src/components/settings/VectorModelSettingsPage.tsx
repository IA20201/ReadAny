/**
 * VectorModelSettingsPage — mobile vector/embedding model configuration.
 * Ported from desktop VectorModelSettings with mobile-optimized layout.
 */
import { BUILTIN_EMBEDDING_MODELS } from "@readany/core/ai/builtin-embedding-models";
import { loadEmbeddingPipeline } from "@readany/core/ai/local-embedding-service";
import { useVectorModelStore } from "@readany/core/stores/vector-model-store";
import type { VectorModelConfig } from "@readany/core/types";
import { ArrowLeft, Check, Download, Edit2, Loader2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { useKeyboardAwareScroll } from "@/lib/use-keyboard-aware-scroll";

function normalizeEmbeddingsUrl(url: string): string {
  return url.replace(/\/$/, "");
}

/* ── Built-in Models Section ── */
function BuiltinModelsSection() {
  const { t } = useTranslation();
  const {
    selectedBuiltinModelId,
    builtinModelStates,
    setSelectedBuiltinModelId,
    updateBuiltinModelState,
  } = useVectorModelStore();

  const handleLoadModel = useCallback(
    async (modelId: string) => {
      updateBuiltinModelState(modelId, { status: "downloading", progress: 0, error: undefined });
      try {
        await loadEmbeddingPipeline(modelId, (progress) => {
          updateBuiltinModelState(modelId, { progress });
        });
        updateBuiltinModelState(modelId, { status: "ready", progress: 100 });
        setSelectedBuiltinModelId(modelId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        updateBuiltinModelState(modelId, { status: "error", error: message });
      }
    },
    [updateBuiltinModelState, setSelectedBuiltinModelId],
  );

  const handleSelect = useCallback(
    async (modelId: string, checked: boolean) => {
      if (!checked) {
        setSelectedBuiltinModelId(null);
        return;
      }
      const state = builtinModelStates[modelId];
      if (state?.status === "ready") {
        setSelectedBuiltinModelId(modelId);
      } else {
        await handleLoadModel(modelId);
      }
    },
    [builtinModelStates, setSelectedBuiltinModelId, handleLoadModel],
  );

  return (
    <div className="px-4 pt-4">
      <h2 className="mb-1 text-sm font-medium">{t("settings.vm_builtinModels")}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{t("settings.vm_builtinDesc")}</p>
      <div className="space-y-2">
        {BUILTIN_EMBEDDING_MODELS.map((model) => {
          const state = builtinModelStates[model.id];
          const isReady = state?.status === "ready";
          const isDownloading = state?.status === "downloading";
          const isSelected = selectedBuiltinModelId === model.id;
          const hasError = state?.status === "error";

          return (
            <div
              key={model.id}
              className={`rounded-xl border p-3.5 transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{model.name}</span>
                    <span className="text-[11px] text-muted-foreground">{model.size}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {t("settings.vm_dimension", { dim: model.dimension })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {model.recommended && (
                      <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {t("settings.vm_recommended")}
                      </span>
                    )}
                    {isReady && (
                      <span className="flex items-center gap-0.5 text-[10px] text-green-600">
                        <Check className="h-3 w-3" />
                        {t("settings.vm_loaded")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 ml-3">
                  {isDownloading ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">
                        {state?.progress ?? 0}%
                      </span>
                    </div>
                  ) : isReady ? (
                    <Switch
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelect(model.id, checked)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs active:bg-muted"
                      onClick={() => handleLoadModel(model.id)}
                    >
                      <Download className="h-3 w-3" />
                      {t("settings.vm_download")}
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-1.5 text-xs text-muted-foreground">
                {t(model.descriptionKey)} · {t(model.languagesKey)}
              </p>

              {hasError && state?.error && (
                <p className="mt-1 text-xs text-destructive">
                  {t("settings.vm_loadError", { error: state.error })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Remote Models Section ── */
function RemoteModelsSection() {
  const { t } = useTranslation();
  const {
    vectorModels,
    selectedVectorModelId,
    addVectorModel,
    updateVectorModel,
    deleteVectorModel,
    setSelectedVectorModelId,
  } = useVectorModelStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<Omit<VectorModelConfig, "id">>({
    name: "",
    url: "",
    modelId: "",
    apiKey: "",
    description: "",
  });

  const resetForm = useCallback(() => {
    setFormData({ name: "", url: "", modelId: "", apiKey: "", description: "" });
    setShowAddForm(false);
    setEditingId(null);
  }, []);

  const handleAdd = useCallback(() => {
    if (!formData.name.trim() || !formData.url.trim() || !formData.modelId.trim()) return;
    const newModel: VectorModelConfig = {
      id: `vm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...formData,
    };
    addVectorModel(newModel);
    resetForm();
  }, [formData, addVectorModel, resetForm]);

  const startEdit = useCallback((model: VectorModelConfig) => {
    setFormData({
      name: model.name,
      url: model.url,
      modelId: model.modelId,
      apiKey: model.apiKey,
      description: model.description || "",
    });
    setEditingId(model.id);
    setShowAddForm(false);
  }, []);

  const handleEdit = useCallback(() => {
    if (!editingId || !formData.name.trim() || !formData.url.trim() || !formData.modelId.trim()) return;
    updateVectorModel(editingId, formData);
    resetForm();
  }, [editingId, formData, updateVectorModel, resetForm]);

  const detectModelDimension = useCallback(
    async (model: VectorModelConfig) => {
      setTestingId(model.id);
      setTestResults((prev) => ({ ...prev, [model.id]: t("settings.vm_testing") }));
      try {
        const testUrl = normalizeEmbeddingsUrl(model.url);
        const isOllama = testUrl.endsWith("/api/embed");
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (model.apiKey.trim()) headers.Authorization = `Bearer ${model.apiKey}`;

        const requestBody = isOllama
          ? { model: model.modelId, input: "test" }
          : { input: ["test"], model: model.modelId, encoding_format: "float" };

        const res = await fetch(testUrl, { method: "POST", headers, body: JSON.stringify(requestBody) });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const json = await res.json();
        const len = isOllama
          ? (json?.embeddings?.[0]?.length ?? 0)
          : (json?.data?.[0]?.embedding?.length ?? 0);

        updateVectorModel(model.id, { dimension: len });
        setTestResults((prev) => ({ ...prev, [model.id]: t("settings.vm_testSuccess", { dimension: len }) }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setTestResults((prev) => ({ ...prev, [model.id]: t("settings.vm_testFailed", { error: message }) }));
      } finally {
        setTestingId(null);
      }
    },
    [t, updateVectorModel],
  );

  const handleModelSelect = useCallback(
    async (model: VectorModelConfig, checked: boolean) => {
      if (checked) {
        setSelectedVectorModelId(model.id);
        if (!model.dimension) await detectModelDimension(model);
      } else {
        setSelectedVectorModelId(null);
      }
    },
    [setSelectedVectorModelId, detectModelDimension],
  );

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-medium">{t("settings.vm_remoteModels")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t("settings.vm_remoteDesc")}</p>
        </div>
        {!showAddForm && !editingId && (
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs active:bg-muted"
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
          >
            <Plus className="h-3 w-3" />
            {t("settings.vm_addModel")}
          </button>
        )}
      </div>

      {vectorModels.length === 0 && !showAddForm && !editingId && (
        <p className="text-xs text-muted-foreground text-center py-6">{t("settings.vm_noRemoteModels")}</p>
      )}

      <div className="space-y-2">
        {vectorModels.map((model) => (
          <div
            key={model.id}
            className={`rounded-xl border p-3.5 transition-colors ${selectedVectorModelId === model.id
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-card"
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">{model.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{model.modelId}</span>
                {model.dimension && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t("settings.vm_dimension", { dim: model.dimension })}
                  </span>
                )}
              </div>
              <Switch
                checked={selectedVectorModelId === model.id}
                onCheckedChange={(checked) => handleModelSelect(model, checked)}
              />
            </div>

            {model.url && <p className="mt-1 text-xs text-muted-foreground truncate">{model.url}</p>}

            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => detectModelDimension(model)}
                disabled={testingId === model.id}
                className="text-xs text-muted-foreground active:text-foreground disabled:opacity-50"
              >
                {testingId === model.id ? t("settings.vm_testing") : t("settings.vm_test")}
              </button>
              <button
                type="button"
                onClick={() => startEdit(model)}
                className="p-1 text-muted-foreground active:text-foreground"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => deleteVectorModel(model.id)}
                className="p-1 text-muted-foreground active:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {testResults[model.id] && (
              <p className={`mt-1 text-xs ${testResults[model.id].includes("✓") ? "text-green-600"
                  : testResults[model.id].includes("✗") ? "text-destructive"
                    : "text-muted-foreground"
                }`}>{testResults[model.id]}</p>
            )}
          </div>
        ))}
      </div>

      {/* Add / Edit form */}
      {(showAddForm || editingId) && (
        <div className="mt-3 rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {editingId ? t("settings.vm_editModel") : t("settings.vm_addModelTitle")}
            </h3>
            <button type="button" className="p-1 active:bg-muted rounded" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("settings.vm_name")} *</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="OpenAI Embedding"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("settings.vm_modelId")} *</label>
              <input
                value={formData.modelId}
                onChange={(e) => setFormData((p) => ({ ...p, modelId: e.target.value }))}
                placeholder="text-embedding-3-small"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("settings.vm_url")} *</label>
              <input
                value={formData.url}
                onChange={(e) => setFormData((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://api.openai.com/v1/embeddings"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">{t("settings.vm_urlHint")}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("settings.vm_apiKey")}</label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData((p) => ({ ...p, apiKey: e.target.value }))}
                placeholder="sk-..."
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("settings.vm_description")}</label>
              <input
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder={t("settings.vm_descriptionPlaceholder")}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 text-xs active:bg-muted"
              onClick={resetForm}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
              disabled={!formData.name.trim() || !formData.url.trim() || !formData.modelId.trim()}
              onClick={editingId ? handleEdit : handleAdd}
            >
              {editingId ? t("common.save") : t("settings.vm_addModel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
export function VectorModelSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    vectorModelEnabled,
    vectorModelMode,
    setVectorModelEnabled,
    setVectorModelMode,
  } = useVectorModelStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  useKeyboardAwareScroll(scrollRef);

  return (
    <div className="flex h-full flex-col">
      <header
        className="shrink-0 px-4 pb-3 border-b border-border bg-background"
        style={{ paddingTop: "calc(var(--safe-area-top) + 12px)" }}
      >
        <div className="flex items-center gap-3">
          <button type="button" className="p-1 -ml-1" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">{t("settings.vm_title")}</h1>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-6">
        {/* Enable switch */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div>
              <h2 className="text-sm font-medium">{t("settings.vm_title")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t("settings.vm_desc")}</p>
            </div>
            <Switch checked={vectorModelEnabled} onCheckedChange={setVectorModelEnabled} />
          </div>
        </div>

        {vectorModelEnabled && (
          <>
            {/* Mode toggle */}
            <div className="px-4 pt-4">
              <h2 className="text-sm font-medium mb-2">{t("settings.vm_modeTitle")}</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 rounded-xl border px-3 py-3 text-left transition-colors ${vectorModelMode === "builtin"
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card active:bg-muted/50"
                    }`}
                  onClick={() => setVectorModelMode("builtin")}
                >
                  <div className="text-sm font-medium">{t("settings.vm_modeBuiltin")}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{t("settings.vm_modeBuiltinDesc")}</div>
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-xl border px-3 py-3 text-left transition-colors ${vectorModelMode === "remote"
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card active:bg-muted/50"
                    }`}
                  onClick={() => setVectorModelMode("remote")}
                >
                  <div className="text-sm font-medium">{t("settings.vm_modeRemote")}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{t("settings.vm_modeRemoteDesc")}</div>
                </button>
              </div>
            </div>

            {/* Content based on mode */}
            {vectorModelMode === "builtin" ? <BuiltinModelsSection /> : <RemoteModelsSection />}
          </>
        )}
      </div>
    </div>
  );
}
