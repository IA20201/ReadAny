import { evictBlobCache } from "@/components/reader/ReaderView";
/**
 * TabBar — draggable tab bar
 * macOS: native traffic lights (left), decorations=true
 * Windows/Linux: custom window controls (right), decorations removed at runtime
 */
import { type Tab, useAppStore } from "@/stores/app-store";
import { useLibraryStore } from "@/stores/library-store";
import { useReaderStore } from "@/stores/reader-store";
import { BookOpen, Home, MessageSquare, NotebookPen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Window as TauriWindow } from "@tauri-apps/api/window";

const TAB_ICONS: Record<string, React.ElementType> = {
  home: Home,
  reader: BookOpen,
  chat: MessageSquare,
  notes: NotebookPen,
};

const DRAG_STYLE = { WebkitAppRegion: "drag" } as Record<string, string>;
const NO_DRAG_STYLE = { WebkitAppRegion: "no-drag" } as Record<string, string>;

function usePlatformInfo() {
  const [info, setInfo] = useState({ isTauri: false, isMac: false, isWinOrLinux: false });
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setInfo({
      isTauri: "__TAURI_INTERNALS__" in window,
      isMac: ua.includes("mac"),
      isWinOrLinux: !ua.includes("mac"),
    });
  }, []);
  return info;
}

function useIsFullscreen() {
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const check = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const w = getCurrentWindow();
        setFs(await w.isFullscreen());
        const unlisten = await w.onResized(async () => { setFs(await w.isFullscreen()); });
        return unlisten;
      } catch { return undefined; }
    };
    let unlisten: (() => void) | undefined;
    check().then((u) => { unlisten = u; });
    return () => unlisten?.();
  }, []);
  return fs;
}

function WindowControls() {
  const { isTauri, isMac, isWinOrLinux } = usePlatformInfo();
  const applied = useRef(false);
  const winRef = useRef<TauriWindow | null>(null);

  useEffect(() => {
    if (!isTauri || applied.current) return;
    applied.current = true;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      const w = getCurrentWindow();
      winRef.current = w;
      w.setDecorations(false).catch(() => {});
    }).catch(() => {});
  }, [isTauri, isMac, isWinOrLinux]);

  if (!isTauri) return null;

  const handlePreventDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div className="flex h-full shrink-0 items-center pr-1" style={NO_DRAG_STYLE} onPointerDown={handlePreventDrag}>
      <button
        type="button"
        className="flex h-8 w-11 items-center justify-center text-neutral-500 transition-colors hover:bg-black/5"
        onPointerDown={handlePreventDrag}
        onClick={(e) => { e.stopPropagation(); winRef.current?.minimize().catch(() => {}); }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(0,0,0,0.05)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
      >
        <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
      </button>
      <button
        type="button"
        className="flex h-8 w-11 items-center justify-center text-neutral-500 transition-colors hover:bg-black/5"
        onPointerDown={handlePreventDrag}
        onClick={(e) => {
          e.stopPropagation();
          if (!winRef.current) return;
          winRef.current.isMaximized().then((m) => m ? winRef.current!.unmaximize() : winRef.current!.maximize()).catch(() => {});
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(0,0,0,0.05)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="0.6" y="0.6" width="7.8" height="7.8"/>
        </svg>
      </button>
      <button
        type="button"
        className="flex h-8 w-11 items-center justify-center text-neutral-500 transition-colors hover:bg-red-600 hover:text-white"
        onPointerDown={handlePreventDrag}
        onClick={(e) => { e.stopPropagation(); winRef.current?.close().catch(() => {}); }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#dc2626"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; (e.currentTarget as HTMLElement).style.color = ""; }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, removeTab } = useAppStore();
  const removeReaderTab = useReaderStore((s) => s.removeTab);
  const books = useLibraryStore((s) => s.books);
  const { isMac, isWinOrLinux, isTauri } = usePlatformInfo();
  const isFullscreen = useIsFullscreen();

  const readerTabs = tabs.filter((t) => t.type !== "home");
  const isReaderActive = readerTabs.some((t) => t.id === activeTabId);

  const handleTabClose = (tabId: string) => {
    const closingTab = tabs.find((t) => t.id === tabId);
    if (closingTab?.bookId) {
      const book = books.find((b) => b.id === closingTab.bookId);
      if (book?.filePath) evictBlobCache(book.filePath);
    }
    removeTab(tabId);
    removeReaderTab(tabId);
    const remainingNonHome = tabs.filter((t) => t.type !== "home" && t.id !== tabId);
    if (remainingNonHome.length === 0) setActiveTab("home");
  };

  return (
    <div
      className="flex h-8 shrink-0 select-none items-center border-neutral-200 bg-muted"
      data-tauri-drag-region
      style={DRAG_STYLE}
    >
      {/* macOS: space for native traffic lights (hidden in reader mode) */}
      <div className="flex h-full shrink-0 items-center" style={{ paddingLeft: (isMac && !isFullscreen && !isReaderActive) ? 68 : 4 }}>
        <button
          type="button"
          className="flex items-center justify-center rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-200/60 hover:text-neutral-800"
          style={NO_DRAG_STYLE}
          onClick={() => setActiveTab("home")}
        >
          <Home className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex h-full flex-1 items-center gap-0.5 overflow-x-auto px-1"
        data-tauri-drag-region
        style={DRAG_STYLE}
      >
        {readerTabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => setActiveTab(tab.id)}
            onClose={() => handleTabClose(tab.id)}
          />
        ))}
      </div>

      {/* Windows/Linux: window controls on right (always show for non-Mac Tauri) */}
      {isTauri && isWinOrLinux && <WindowControls />}
    </div>
  );
}

function TabItem({
  tab,
  isActive,
  onActivate,
  onClose,
}: {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  const Icon = TAB_ICONS[tab.type] ?? BookOpen;

  return (
    <div
      className={`group flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs transition-all ${
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
      style={NO_DRAG_STYLE}
      onClick={onActivate}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="max-w-[120px] truncate">{tab.title}</span>
      <button
        type="button"
        className="ml-0.5 hidden h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-neutral-200/80 hover:text-foreground group-hover:flex"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}