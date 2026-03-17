/**
 * Shared sync store — manages WebDAV sync configuration and state.
 * Used by both desktop (Tauri) and mobile (Expo).
 */

import { create } from "zustand";
import { getPlatformService } from "../services/platform";
import { WebDavClient } from "../sync/webdav-client";
import { determineSyncDirection, runSync } from "../sync/sync-engine";
import type {
  SyncConfig,
  SyncDirection,
  SyncResult,
  SyncStatusType,
  SyncProgress,
} from "../sync/sync-types";
import { DEFAULT_SYNC_CONFIG } from "../sync/sync-types";
import { getVectorDB, hasVectorDB } from "../rag/vector-db";

const SYNC_CONFIG_KEY = "sync_config";
const SYNC_PASSWORD_KEY = "sync_password";

export interface SyncState {
  // Config
  config: SyncConfig | null;
  isConfigured: boolean;

  // Runtime state
  status: SyncStatusType;
  lastSyncAt: number | null;
  lastResult: SyncResult | null;
  error: string | null;
  progress: SyncProgress | null;

  // Conflict resolution
  pendingDirection: SyncDirection | null;

  // Actions
  loadConfig: () => Promise<void>;
  saveConfig: (
    url: string,
    username: string,
    password: string,
  ) => Promise<void>;
  testConnection: (
    url: string,
    username: string,
    password: string,
  ) => Promise<boolean>;
  syncNow: (
    resolvedDirection?: "upload" | "download",
  ) => Promise<SyncResult | null>;
  setAutoSync: (enabled: boolean) => Promise<void>;
  setWifiOnly: (enabled: boolean) => Promise<void>;
  setNotifyOnComplete: (enabled: boolean) => Promise<void>;
  resetSync: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  config: null,
  isConfigured: false,
  status: "idle",
  lastSyncAt: null,
  lastResult: null,
  error: null,
  progress: null,
  pendingDirection: null,

  loadConfig: async () => {
    try {
      const platform = getPlatformService();
      const configStr = await platform.kvGetItem(SYNC_CONFIG_KEY);
      if (configStr) {
        const config = JSON.parse(configStr) as SyncConfig;
        const password = await platform.kvGetItem(SYNC_PASSWORD_KEY);
        set({
          config,
          isConfigured: !!(config.url && config.username && password),
        });
      }
    } catch {
      // Config not yet saved — that's fine
    }
  },

  saveConfig: async (url, username, password) => {
    const platform = getPlatformService();
    const existing = get().config;
    const config: SyncConfig = {
      url: url.replace(/\/+$/, ""),
      username,
      autoSync: existing?.autoSync ?? DEFAULT_SYNC_CONFIG.autoSync!,
      syncIntervalMins:
        existing?.syncIntervalMins ??
        DEFAULT_SYNC_CONFIG.syncIntervalMins!,
      wifiOnly: existing?.wifiOnly ?? DEFAULT_SYNC_CONFIG.wifiOnly!,
      notifyOnComplete:
        existing?.notifyOnComplete ??
        DEFAULT_SYNC_CONFIG.notifyOnComplete!,
    };
    await platform.kvSetItem(SYNC_CONFIG_KEY, JSON.stringify(config));
    await platform.kvSetItem(SYNC_PASSWORD_KEY, password);
    set({ config, isConfigured: true });
  },

  testConnection: async (url, username, password) => {
    const client = new WebDavClient(url, username, password);
    return client.testConnection();
  },

  syncNow: async (resolvedDirection) => {
    const state = get();
    if (state.status !== "idle") return null;
    if (!state.isConfigured || !state.config) {
      set({ error: "Sync not configured" });
      return null;
    }

    const platform = getPlatformService();
    const password = await platform.kvGetItem(SYNC_PASSWORD_KEY);
    if (!password) {
      set({ error: "No password configured" });
      return null;
    }

    set({ status: "checking", error: null, pendingDirection: null });

    try {
      const client = new WebDavClient(
        state.config.url,
        state.config.username,
        password,
      );

      // Test connection
      await client.ping();

      let direction: "upload" | "download";
      let remoteManifest: import("../sync/sync-types").RemoteSyncManifest | null = null;

      if (resolvedDirection) {
        // User already resolved the conflict
        direction = resolvedDirection;
      } else {
        // Determine direction automatically
        const result = await determineSyncDirection(client);
        remoteManifest = result.remoteManifest;

        if (result.direction === "none") {
          set({ status: "idle", lastSyncAt: Date.now() });
          return {
            success: true,
            direction: "none",
            filesUploaded: 0,
            filesDownloaded: 0,
            durationMs: 0,
          };
        }

        if (result.direction === "conflict") {
          // Store the pending direction and return — UI will show dialog
          set({ status: "idle", pendingDirection: "conflict" });
          return null;
        }

        direction = result.direction;
      }

      // Execute sync
      set({
        status: direction === "upload" ? "uploading" : "downloading",
        progress: null,
      });

      // Progress callback to update store
      const onProgress = (progress: SyncProgress) => {
        set({ progress });
      };

      const onDatabaseReplaced = async () => {
        if (hasVectorDB()) {
          const vectorDB = getVectorDB();
          if (vectorDB?.rebuild && await vectorDB.isReady()) {
            console.log("[Sync] Rebuilding vector index after download...");
            try {
              const count = await vectorDB.rebuild();
              console.log(`[Sync] Rebuilt ${count} vectors`);
            } catch (e) {
              console.error("[Sync] Failed to rebuild vector index:", e);
            }
          }
        }
      };

      const syncResult = await runSync(client, direction, onProgress, remoteManifest, onDatabaseReplaced);

      set({
        status: "idle",
        lastSyncAt: Date.now(),
        lastResult: syncResult,
        error: syncResult.error || null,
        pendingDirection: null,
        progress: null,
      });

      return syncResult;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      set({ status: "error", error, pendingDirection: null, progress: null });
      return {
        success: false,
        direction: "none",
        filesUploaded: 0,
        filesDownloaded: 0,
        durationMs: 0,
        error,
      };
    }
  },

  setAutoSync: async (enabled) => {
    const state = get();
    if (!state.config) return;
    const config = { ...state.config, autoSync: enabled };
    const platform = getPlatformService();
    await platform.kvSetItem(SYNC_CONFIG_KEY, JSON.stringify(config));
    set({ config });
  },

  setWifiOnly: async (enabled) => {
    const state = get();
    if (!state.config) return;
    const config = { ...state.config, wifiOnly: enabled };
    const platform = getPlatformService();
    await platform.kvSetItem(SYNC_CONFIG_KEY, JSON.stringify(config));
    set({ config });
  },

  setNotifyOnComplete: async (enabled) => {
    const state = get();
    if (!state.config) return;
    const config = { ...state.config, notifyOnComplete: enabled };
    const platform = getPlatformService();
    await platform.kvSetItem(SYNC_CONFIG_KEY, JSON.stringify(config));
    set({ config });
  },

  resetSync: async () => {
    const platform = getPlatformService();
    await platform.kvRemoveItem(SYNC_CONFIG_KEY);
    await platform.kvRemoveItem(SYNC_PASSWORD_KEY);
    set({
      config: null,
      isConfigured: false,
      status: "idle",
      lastSyncAt: null,
      lastResult: null,
      error: null,
      progress: null,
      pendingDirection: null,
    });
  },
}));
