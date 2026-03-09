/**
 * MobilePlatformService — IPlatformService implementation for Tauri v2 mobile (iOS/Android).
 *
 * Uses the same Tauri plugins as desktop, but:
 * - platformType = "mobile"
 * - No updater/process plugins (mobile updates via app stores)
 * - File picker uses Tauri dialog plugin (works on mobile)
 */
import type {
  IPlatformService,
  IDatabase,
  IWebSocket,
  FilePickerOptions,
  WebSocketOptions,
} from "@readany/core/services";

/** Adapter: wraps Tauri SQL plugin instance as IDatabase */
function wrapTauriDatabase(tauriDb: any): IDatabase {
  return {
    execute: (sql: string, params?: unknown[]) => tauriDb.execute(sql, params ?? []),
    select: <T>(sql: string, params?: unknown[]): Promise<T[]> => tauriDb.select(sql, params ?? []),
    close: () => tauriDb.close(),
  };
}

export class MobilePlatformService implements IPlatformService {
  readonly platformType = "mobile" as const;
  readonly isMobile = true;
  readonly isDesktop = false;

  // ---- File system ----

  async readFile(path: string): Promise<Uint8Array> {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    return readFile(path);
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(path, data);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, content);
  }

  async readTextFile(path: string): Promise<string> {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    return readTextFile(path);
  }

  async mkdir(path: string): Promise<void> {
    const { mkdir } = await import("@tauri-apps/plugin-fs");
    await mkdir(path, { recursive: true });
  }

  async exists(path: string): Promise<boolean> {
    const { exists } = await import("@tauri-apps/plugin-fs");
    return exists(path);
  }

  async deleteFile(path: string): Promise<void> {
    const { remove } = await import("@tauri-apps/plugin-fs");
    await remove(path);
  }

  async getAppDataDir(): Promise<string> {
    const { appDataDir } = await import("@tauri-apps/api/path");
    return appDataDir();
  }

  async joinPath(...parts: string[]): Promise<string> {
    const { join } = await import("@tauri-apps/api/path");
    return join(...parts);
  }

  convertFileSrc(path: string): string {
    if (!this._convertFileSrc) {
      throw new Error(
        "convertFileSrc not ready. Call initSync() first.",
      );
    }
    return this._convertFileSrc(path);
  }

  private _convertFileSrc: ((path: string) => string) | null = null;

  /** Must be called once after construction to initialize sync utilities. */
  async initSync(): Promise<void> {
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    this._convertFileSrc = convertFileSrc;
  }

  // ---- File picker ----

  async pickFile(options?: FilePickerOptions): Promise<string | null> {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      multiple: options?.multiple ?? false,
      filters: options?.filters,
    });
    if (Array.isArray(result)) return result[0] ?? null;
    return result;
  }

  // ---- Database ----

  async loadDatabase(path: string): Promise<IDatabase> {
    const Database = (await import("@tauri-apps/plugin-sql")).default;
    const tauriDb = await Database.load(path);
    return wrapTauriDatabase(tauriDb);
  }

  // ---- Network ----

  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(url, options);
  }

  async createWebSocket(
    url: string,
    options?: WebSocketOptions,
  ): Promise<IWebSocket> {
    const WebSocket = (await import("@tauri-apps/plugin-websocket")).default;
    const ws = await WebSocket.connect(url, {
      headers: options?.headers,
    });

    return {
      send: (data: string | ArrayBuffer) => {
        if (typeof data === "string") {
          ws.send(data);
        } else {
          ws.send(Array.from(new Uint8Array(data)));
        }
      },
      close: () => ws.disconnect(),
      onMessage: (handler) => {
        ws.addListener((msg) => {
          if (typeof msg === "string") handler(msg);
          else if (msg && typeof msg === "object" && "data" in msg) {
            handler((msg as any).data);
          }
        });
      },
      onClose: (handler) => {
        ws.addListener((msg) => {
          if (msg && typeof msg === "object" && "type" in msg && (msg as any).type === "Close") {
            handler();
          }
        });
      },
      onError: (handler) => {
        ws.addListener((msg) => {
          if (msg && typeof msg === "object" && "type" in msg && (msg as any).type === "Error") {
            handler((msg as any).data);
          }
        });
      },
    };
  }

  // ---- App info ----

  async getAppVersion(): Promise<string> {
    const { getVersion } = await import("@tauri-apps/api/app");
    return getVersion();
  }

  // ---- Update (noop on mobile — updates via app stores) ----

  async checkUpdate() {
    return null;
  }

  async installUpdate() {
    // noop on mobile
  }

  // ---- KV Storage (backed by localStorage in Tauri mobile WebView) ----

  async kvGetItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async kvSetItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async kvRemoveItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async kvGetAllKeys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    return keys;
  }

  // ---- Clipboard ----

  async copyToClipboard(content: string): Promise<void> {
    await navigator.clipboard.writeText(content);
  }

  // ---- File sharing / download ----

  async shareOrDownloadFile(
    content: string,
    filename: string,
    mimeType: string,
  ): Promise<void> {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
