import { useEffect, useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { Maximize2, Minimize2, Download, ZoomIn, ZoomOut } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

interface MindmapViewProps {
  markdown: string;
  title?: string;
}

const transformer = new Transformer();

export function MindmapView({ markdown, title }: MindmapViewProps) {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const fullscreenSvgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const fullscreenMarkmapRef = useRef<Markmap | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [scale, setScale] = useState(1);
  const [showTooltip, setShowTooltip] = useState(false);

  const renderMap = useCallback(() => {
    if (!svgRef.current || !markdown) return;

    const { root } = transformer.transform(markdown);

    if (markmapRef.current) {
      markmapRef.current.setData(root);
      markmapRef.current.fit();
    } else {
      markmapRef.current = Markmap.create(svgRef.current, {
        autoFit: true,
        duration: 300,
        maxWidth: 300,
        paddingX: 16,
        style: (id: string) => `
          .${id} {
            --markmap-text-color: var(--foreground);
            --markmap-code-bg: var(--muted);
            --markmap-code-color: var(--foreground);
            --markmap-circle-open-bg: var(--background);
          }
          .${id} .markmap-foreign {
            color: var(--foreground);
          }
          .${id} .markmap-foreign a {
            color: var(--foreground);
          }
          .${id} .markmap-foreign a:hover {
            color: var(--foreground);
          }
          .${id} .markmap-foreign code {
            color: var(--foreground);
            background-color: var(--muted);
          }
        `,
      }, root);
    }
  }, [markdown]);

  const renderFullscreenMap = useCallback(() => {
    if (!fullscreenSvgRef.current || !markdown || !expanded) return;

    const { root } = transformer.transform(markdown);

    if (fullscreenMarkmapRef.current) {
      fullscreenMarkmapRef.current.setData(root);
      setTimeout(() => fullscreenMarkmapRef.current?.fit(), 100);
    } else {
      fullscreenMarkmapRef.current = Markmap.create(fullscreenSvgRef.current, {
        autoFit: true,
        duration: 300,
        maxWidth: 400,
        paddingX: 24,
        style: (id: string) => `
          .${id} {
            --markmap-text-color: var(--foreground);
            --markmap-code-bg: var(--muted);
            --markmap-code-color: var(--foreground);
            --markmap-circle-open-bg: var(--background);
          }
          .${id} .markmap-foreign {
            color: var(--foreground);
          }
          .${id} .markmap-foreign a {
            color: var(--foreground);
          }
          .${id} .markmap-foreign a:hover {
            color: var(--foreground);
          }
          .${id} .markmap-foreign code {
            color: var(--foreground);
            background-color: var(--muted);
          }
        `,
      }, root);
    }
  }, [markdown, expanded]);

  useEffect(() => {
    renderMap();
  }, [renderMap]);

  useEffect(() => {
    if (expanded) {
      setTimeout(renderFullscreenMap, 50);
    } else {
      fullscreenMarkmapRef.current = null;
    }
  }, [expanded, renderFullscreenMap]);

  useEffect(() => {
    if (!expanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  const handleDownload = useCallback(() => {
    const svgElement = expanded ? fullscreenSvgRef.current : svgRef.current;
    if (!svgElement) return;

    // Clone the SVG to modify it
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    
    // Get the SVG dimensions
    const bbox = svgElement.getBBox();
    const width = bbox.width + bbox.x + 40;
    const height = bbox.height + bbox.y + 40;
    
    // Add white background
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", "white");
    clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);
    
    // Add font styles
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
      text {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      }
    `;
    clonedSvg.insertBefore(style, clonedSvg.firstChild);

    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = `${title || t("mindmap.title")}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
    
    // Show success message
    toast.success(t("common.downloadSuccess", "图表已下载"));
  }, [expanded, title, t]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.2, 0.3));
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    markmapRef.current?.fit();
    fullscreenMarkmapRef.current?.fit();
  }, []);

  const displayTitle = title && title.length > 20 ? title.slice(0, 20) + "..." : title;

  const fullscreenOverlay = expanded
    ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setExpanded(false)}
            onKeyDown={() => {}}
          />
          <div className="relative z-10 m-4 flex h-[90vh] w-[90vw] max-w-6xl flex-col rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span
                className="text-base font-medium text-foreground cursor-default"
                title={title && title.length > 20 ? title : undefined}
              >
                {displayTitle || t("mindmap.title")}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="rounded p-1.5 hover:bg-muted transition-colors"
                  title={t("common.zoomOut", "缩小")}
                >
                  <ZoomOut className="h-5 w-5 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="text-xs text-muted-foreground min-w-[3rem] hover:text-foreground transition-colors"
                  title={t("common.resetZoom", "重置缩放")}
                >
                  {Math.round(scale * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="rounded p-1.5 hover:bg-muted transition-colors"
                  title={t("common.zoomIn", "放大")}
                >
                  <ZoomIn className="h-5 w-5 text-muted-foreground" />
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button
                  type="button"
                  onClick={handleDownload}
                  className="rounded p-1.5 hover:bg-muted transition-colors"
                  title={t("mindmap.download")}
                >
                  <Download className="h-5 w-5 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="rounded p-1.5 hover:bg-muted transition-colors"
                  title={t("mindmap.exitFullscreen")}
                >
                  <Minimize2 className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <svg
                ref={fullscreenSvgRef}
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "center center",
                }}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <div className="relative rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span
            className="text-sm font-medium text-foreground cursor-default"
            title={title && title.length > 20 ? title : undefined}
          >
            {displayTitle || t("mindmap.title")}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleZoomOut}
              className="rounded p-1 hover:bg-muted transition-colors"
              title={t("common.zoomOut", "缩小")}
            >
              <ZoomOut className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="text-xs text-muted-foreground min-w-[3rem] text-center hover:text-foreground transition-colors"
              title={t("common.resetZoom", "重置缩放")}
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="rounded p-1 hover:bg-muted transition-colors"
              title={t("common.zoomIn", "放大")}
            >
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <button
              type="button"
              onClick={handleDownload}
              className="rounded p-1 hover:bg-muted transition-colors"
              title={t("mindmap.download")}
            >
              <Download className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded p-1 hover:bg-muted transition-colors"
              title={t("mindmap.fullscreen")}
            >
              <Maximize2 className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="overflow-auto" style={{ height: 400 }}>
          <svg
            ref={svgRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "center center",
            }}
            className="w-full h-full"
          />
        </div>
      </div>

      {fullscreenOverlay}
    </>
  );
}
