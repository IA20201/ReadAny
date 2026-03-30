/**
 * FontSettings — custom font management for desktop
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFontStore, generateFontId, saveFontFile, getCSSFontFace, getFontsDir } from "@readany/core/stores";
import type { CustomFont } from "@readany/core/types/font";
import { getPlatformService } from "@readany/core/services";
import { useTranslation } from "react-i18next";
import { useCallback, useState, useEffect } from "react";
import { Trash2Icon, UploadIcon, FileTextIcon, AlertCircleIcon, GlobeIcon } from "lucide-react";

const FONT_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

export function FontSettings() {
  const { t } = useTranslation();
  const fonts = useFontStore((s) => s.fonts);
  const addFont = useFontStore((s) => s.addFont);
  const removeFont = useFontStore((s) => s.removeFont);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fontName, setFontName] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontsBaseUrl, setFontsBaseUrl] = useState<string>("");

  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteUrlWoff2, setRemoteUrlWoff2] = useState("");
  const [remoteFontName, setRemoteFontName] = useState("");

  useEffect(() => {
    getFontsDir().then((dir) => {
      const platform = getPlatformService();
      setFontsBaseUrl(platform.convertFileSrc(dir));
    });
  }, []);

  const handlePickFont = useCallback(async () => {
    try {
      const platform = getPlatformService();
      const result = await platform.pickFile({
        filters: [{ name: "Font Files", extensions: ["ttf", "otf", "woff", "woff2"] }],
      });
      if (result && typeof result === "string") {
        setSelectedFile(result);
        const fileName = result.split(/[/\\]/).pop() || "";
        const nameWithoutExt = fileName.replace(/\.(ttf|otf|woff|woff2)$/i, "");
        setFontName(nameWithoutExt);
        setError(null);
      }
    } catch (err) {
      console.error("[FontSettings] Pick file error:", err);
      setError(t("fonts.pickError", "Failed to pick font file"));
    }
  }, [t]);

  const handleImport = useCallback(async () => {
    if (!selectedFile || !fontName.trim()) return;

    setImporting(true);
    setError(null);

    try {
      const platform = getPlatformService();
      const exists = await platform.exists(selectedFile);
      if (!exists) {
        throw new Error(t("fonts.fileNotFound", "Font file not found"));
      }

      const { filePath, fileName, size } = await saveFontFile(selectedFile, fontName.trim());

      if (size > FONT_SIZE_LIMIT) {
        await platform.deleteFile(filePath);
        throw new Error(t("fonts.tooLarge", "Font file is too large (max 10MB)"));
      }

      const fontFamily = `Custom-${fontName.trim().replace(/\s+/g, "-")}`;

      const font: CustomFont = {
        id: generateFontId(),
        name: fontName.trim(),
        fileName,
        filePath,
        fontFamily,
        format: fileName.split(".").pop()?.toLowerCase() as "ttf" | "otf" | "woff" | "woff2" || "ttf",
        size,
        addedAt: Date.now(),
        source: "local",
      };

      addFont(font);
      setImportDialogOpen(false);
      setSelectedFile(null);
      setFontName("");
    } catch (err) {
      console.error("[FontSettings] Import error:", err);
      setError(err instanceof Error ? err.message : t("fonts.importError", "Failed to import font"));
    } finally {
      setImporting(false);
    }
  }, [selectedFile, fontName, addFont, t]);

  const handleImportRemote = useCallback(async () => {
    if (!remoteFontName.trim() || !remoteUrl.trim()) return;

    setImporting(true);
    setError(null);

    try {
      const fontFamily = `Custom-${remoteFontName.trim().replace(/\s+/g, "-")}`;
      const url = remoteUrl.trim();
      const woff2Url = remoteUrlWoff2.trim();

      const format = url.endsWith(".woff2") ? "woff2" : url.endsWith(".woff") ? "woff" : "woff2";

      const font: CustomFont = {
        id: generateFontId(),
        name: remoteFontName.trim(),
        fileName: `remote-${Date.now()}.${format}`,
        fontFamily,
        format,
        addedAt: Date.now(),
        source: "remote",
        remoteUrl: url,
        remoteUrlWoff2: woff2Url || undefined,
      };

      addFont(font);
      setImportDialogOpen(false);
      setRemoteUrl("");
      setRemoteUrlWoff2("");
      setRemoteFontName("");
    } catch (err) {
      console.error("[FontSettings] Import remote error:", err);
      setError(err instanceof Error ? err.message : t("fonts.importError", "Failed to import font"));
    } finally {
      setImporting(false);
    }
  }, [remoteFontName, remoteUrl, remoteUrlWoff2, addFont, t]);

  const handleDelete = useCallback(
    async (font: CustomFont) => {
      if (window.confirm(t("fonts.deleteConfirm", "Delete font \"{{name}}\"?", { name: font.name }))) {
        await removeFont(font.id);
      }
    },
    [removeFont, t],
  );

  const formatSize = (bytes?: number): string => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 p-4">
      <section className="rounded-lg bg-muted/60 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">{t("fonts.title", "字体")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("fonts.desc", "导入自定义字体，在阅读器中使用")}
            </p>
          </div>
          <Button size="sm" onClick={() => setImportDialogOpen(true)}>
            <UploadIcon className="mr-1.5 h-4 w-4" />
            {t("fonts.import", "导入字体")}
          </Button>
        </div>

        {fonts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileTextIcon className="mb-2 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {t("fonts.empty", "暂无自定义字体，点击上方按钮导入")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {fonts.map((font) => (
              <div
                key={font.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{font.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {font.format.toUpperCase()}
                    </span>
                    {font.source === "remote" && (
                      <span className="flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-500">
                        <GlobeIcon className="h-3 w-3" />
                        {t("fonts.remote", "在线")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatSize(font.size)}</span>
                    <span>
                      {t("fonts.addedAt", "添加于")} {new Date(font.addedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {(fontsBaseUrl || font.source === "remote") && (
                    <div
                      className="mt-2 rounded border border-border bg-muted/50 p-2"
                      style={{
                        fontFamily: `'${font.fontFamily}', sans-serif`,
                        fontSize: "14px",
                      }}
                    >
                      <style>{getCSSFontFace(font, fontsBaseUrl)}</style>
                      {t("fonts.preview", "预览文字：阅读改变世界 The quick brown fox")}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(font)}
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("fonts.importTitle", "导入字体")}</DialogTitle>
            <DialogDescription>
              {t("fonts.importDesc", "支持本地文件或在线链接导入")}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="file" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file">{t("fonts.fromFile", "本地文件")}</TabsTrigger>
              <TabsTrigger value="url">{t("fonts.fromUrl", "在线链接")}</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="font-file">{t("fonts.file", "字体文件")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="font-file"
                      value={selectedFile ? selectedFile.split(/[/\\]/).pop() : ""}
                      readOnly
                      placeholder={t("fonts.selectFile", "选择字体文件...")}
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={handlePickFont}>
                      {t("fonts.browse", "浏览")}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="font-name">{t("fonts.name", "字体名称")}</Label>
                  <Input
                    id="font-name"
                    value={fontName}
                    onChange={(e) => setFontName(e.target.value)}
                    placeholder={t("fonts.namePlaceholder", "输入显示名称")}
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircleIcon className="h-4 w-4" />
                    {error}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                    {t("common.cancel", "取消")}
                  </Button>
                  <Button onClick={handleImport} disabled={!selectedFile || !fontName.trim() || importing}>
                    {importing ? t("fonts.importing", "导入中...") : t("fonts.import", "导入")}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="url" className="mt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="remote-name">{t("fonts.name", "字体名称")}</Label>
                  <Input
                    id="remote-name"
                    value={remoteFontName}
                    onChange={(e) => setRemoteFontName(e.target.value)}
                    placeholder={t("fonts.namePlaceholder", "输入显示名称")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="remote-url-woff2">{t("fonts.urlWoff2", "WOFF2 链接")}</Label>
                  <Input
                    id="remote-url-woff2"
                    value={remoteUrlWoff2}
                    onChange={(e) => setRemoteUrlWoff2(e.target.value)}
                    placeholder="https://example.com/font.woff2"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="remote-url">{t("fonts.urlWoff", "WOFF 链接 (备选)")}</Label>
                  <Input
                    id="remote-url"
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    placeholder="https://example.com/font.woff"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("fonts.urlHint", "示例：阿里云字体库、Google Fonts 等提供的字体 CDN 链接")}
                </p>
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircleIcon className="h-4 w-4" />
                    {error}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                    {t("common.cancel", "取消")}
                  </Button>
                  <Button onClick={handleImportRemote} disabled={!remoteFontName.trim() || (!remoteUrl.trim() && !remoteUrlWoff2.trim()) || importing}>
                    {importing ? t("fonts.importing", "导入中...") : t("fonts.import", "导入")}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
