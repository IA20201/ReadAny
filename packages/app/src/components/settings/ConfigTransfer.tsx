import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decodeConfig, encodeConfig } from "@readany/core/utils";
import { Check, Copy, Download, QrCode, Scan, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

interface ConfigTransferProps<T> {
  getData: () => T;
  applyData: (data: unknown) => void;
  validate: (data: unknown) => boolean;
  label: string;
}

export function ConfigTransfer<T>({ getData, applyData, validate, label }: ConfigTransferProps<T>) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"idle" | "export" | "import">("idle");
  const [token, setToken] = useState("");
  const [importText, setImportText] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    try {
      const data = getData();
      const encoded = encodeConfig(data);
      setToken(encoded);
      setMode("export");
    } catch {
      toast.error(t("settings.exportFailed", "导出失败，数据可能过大"));
    }
  }, [getData, t]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success(t("common.copied", "已复制"));
    setTimeout(() => setCopied(false), 2000);
  }, [token, t]);

  const applyImportedData = useCallback(
    (raw: string) => {
      const data = decodeConfig(raw.trim());
      if (!data || !validate(data)) {
        toast.error(t("settings.invalidConfig", "配置格式无效"));
        return;
      }
      applyData(data);
      toast.success(t("settings.configImported", "配置已导入"));
      setMode("idle");
      setImportText("");
    },
    [validate, applyData, t],
  );

  const handleImport = useCallback(() => applyImportedData(importText), [importText, applyImportedData]);

  const handleScanQR = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleQRFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Use BarcodeDetector API (Chromium-based browsers / Tauri WebView)
        const win = window as typeof window & {
          BarcodeDetector?: new (opts: { formats: string[] }) => {
            detect: (img: ImageData) => Promise<Array<{ rawValue: string }>>;
          };
        };
        if (win.BarcodeDetector) {
          try {
            const detector = new win.BarcodeDetector({ formats: ["qr"] });
            const results = await detector.detect(imageData);
            if (results.length > 0) {
              applyImportedData(results[0].rawValue);
              return;
            }
          } catch {
            // detection failed
          }
        }

        toast.error(t("settings.qrDecodeFailed", "无法识别二维码，请尝试粘贴口令"));
      } catch {
        toast.error(t("settings.qrDecodeFailed", "无法识别二维码，请尝试粘贴口令"));
      }

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [applyImportedData, t],
  );

  if (mode === "export") {
    const canShowQR = token.length <= 2900;
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
        {canShowQR && (
          <div className="rounded-lg bg-white p-3">
            <QRCodeSVG value={token} size={160} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {canShowQR
            ? t("settings.scanOrCopy", "扫描二维码或复制口令，在另一台设备导入")
            : t("settings.copyToken", "数据较大，请复制口令后在另一台设备导入")}
        </p>
        <div className="flex w-full gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleCopy}>
            {copied ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
            {t("common.copy", "复制口令")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMode("idle")}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "import") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
        <Textarea
          placeholder={t("settings.pasteConfig", "粘贴配置口令...")}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          className="min-h-[80px] font-mono text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={handleImport} disabled={!importText.trim()}>
            <Download className="mr-1.5 size-3.5" />
            {t("settings.importConfig", "导入")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setMode("idle"); setImportText(""); }}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <QrCode className="mr-1.5 size-3.5" />
          {t("settings.exportConfig", "导出")} {label}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMode("import")}>
          <Download className="mr-1.5 size-3.5" />
          {t("settings.importConfig", "导入")} {label}
        </Button>
      </div>
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleQRFileChange}
        />
        <Button variant="outline" size="sm" onClick={handleScanQR}>
          <Scan className="mr-1.5 size-3.5" />
          {t("settings.scanQRCode", "扫码导入")}
        </Button>
      </div>
    </div>
  );
}
