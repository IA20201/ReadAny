/**
 * Simplified sync service — incremental, per-device, JSON-based.
 *
 * Design:
 * 1. Each device writes to its own file: /readany/sync/device-{id}.json
 *    → No write conflicts between devices
 * 2. Pull all other devices' files and apply changes (last-write-wins per record)
 * 3. Push local changes since last sync
 * 4. Tombstones for deletions
 */

import { ensureNoTransaction, getDB } from "../db/database";
import type { ISyncBackend } from "./sync-backend";

/** Tables included in sync, with their primary key and timestamp column */
const SYNC_TABLES = [
  { name: "books",      pk: "id", timestampCol: "updated_at" },
  { name: "highlights", pk: "id", timestampCol: "updated_at" },
  { name: "notes",      pk: "id", timestampCol: "updated_at" },
  { name: "bookmarks",  pk: "id", timestampCol: "updated_at" },
  { name: "threads",    pk: "id", timestampCol: "updated_at" },
  { name: "messages",   pk: "id", timestampCol: "created_at" },
  { name: "skills",     pk: "id", timestampCol: "updated_at" },
] as const;

/** Remote directory for per-device sync files */
const SYNC_DIR = "/readany/sync";

/** Build the remote path for a device's changeset file */
function deviceSyncPath(deviceId: string): string {
  return `${SYNC_DIR}/device-${deviceId}.json`;
}

export interface TableChangeset {
  records: Record<string, unknown>[];
  deletedIds: string[];
}

export interface DeviceSyncPayload {
  deviceId: string;
  /** Unix ms timestamp of when this payload was generated */
  timestamp: number;
  /** The last sync timestamp this device used to collect changes */
  since: number;
  tables: {
    [tableName: string]: TableChangeset;
  };
}

// ---------------------------------------------------------------------------
// Metadata helpers
// ---------------------------------------------------------------------------

async function getDeviceId(): Promise<string> {
  const db = await getDB();
  const rows = await db.select<{ value: string }>(
    "SELECT value FROM sync_metadata WHERE key = 'device_id'",
  );
  if (rows[0]?.value) return rows[0].value;

  const deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await db.execute(
    "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('device_id', ?)",
    [deviceId],
  );
  return deviceId;
}

async function getLastSyncTimestamp(): Promise<number> {
  const db = await getDB();
  const rows = await db.select<{ value: string }>(
    "SELECT value FROM sync_metadata WHERE key = 'last_sync_at'",
  );
  return rows[0]?.value ? Number.parseInt(rows[0].value, 10) : 0;
}

async function setLastSyncTimestamp(timestamp: number): Promise<void> {
  const db = await getDB();
  await db.execute(
    "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('last_sync_at', ?)",
    [String(timestamp),]
  );
}

// ---------------------------------------------------------------------------
// Collect local changes
// ---------------------------------------------------------------------------

export async function collectChanges(since: number): Promise<DeviceSyncPayload> {
  await ensureNoTransaction();
  const db = await getDB();
  const deviceId = await getDeviceId();
  const now = Date.now();

  const payload: DeviceSyncPayload = {
    deviceId,
    timestamp: now,
    since,
    tables: {},
  };

  for (const { name, timestampCol } of SYNC_TABLES) {
    const records = await db.select<Record<string, unknown>>(
      `SELECT * FROM ${name} WHERE ${timestampCol} > ?`,
      [since],
    );

    let deletedIds: string[] = [];
    try {
      const tombstones = await db.select<{ id: string }>(
        "SELECT id FROM sync_tombstones WHERE table_name = ? AND deleted_at > ?",
        [name, since],
      );
      deletedIds = tombstones.map((t) => t.id);
    } catch {
      // sync_tombstones may not exist on older schema
    }

    if (records.length > 0 || deletedIds.length > 0) {
      payload.tables[name] = { records, deletedIds };
    }
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Apply remote changes
// ---------------------------------------------------------------------------

export async function applyChanges(
  payload: DeviceSyncPayload,
): Promise<{ applied: number; skipped: number }> {
  await ensureNoTransaction();
  const db = await getDB();
  let applied = 0;
  let skipped = 0;
  let inTransaction = false;

  try {
    await db.execute("BEGIN TRANSACTION", []);
    inTransaction = true;

    for (const [tableName, tableData] of Object.entries(payload.tables)) {
      const tableInfo = SYNC_TABLES.find((t) => t.name === tableName);
      if (!tableInfo) continue;

      const { pk, timestampCol } = tableInfo;

      // Apply upserts (last-write-wins by timestamp)
      for (const record of tableData.records) {
        const pkValue = record[pk];
        const remoteTs = record[timestampCol] as number;

        const existing = await db.select<Record<string, unknown>>(
          `SELECT ${timestampCol} FROM ${tableName} WHERE ${pk} = ?`,
          [pkValue],
        );

        if (existing.length > 0) {
          const localTs = existing[0][timestampCol] as number;
          if (remoteTs > localTs) {
            await upsertRecord(db, tableName, record, pk);
            applied++;
          } else {
            skipped++;
          }
        } else {
          await upsertRecord(db, tableName, record, pk);
          applied++;
        }
      }

      // Apply deletions
      for (const deletedId of tableData.deletedIds) {
        await db.execute(`DELETE FROM ${tableName} WHERE ${pk} = ?`, [deletedId]);
        applied++;
      }
    }

    await db.execute("COMMIT", []);
    inTransaction = false;
  } catch (e) {
    if (inTransaction) {
      try { await db.execute("ROLLBACK", []); } catch { /* ignore */ }
    }
    throw e;
  }

  return { applied, skipped };
}

async function upsertRecord(
  db: Awaited<ReturnType<typeof getDB>>,
  table: string,
  record: Record<string, unknown>,
  pk: string,
): Promise<void> {
  const columns = Object.keys(record);
  const values = Object.values(record);
  const placeholders = columns.map(() => "?").join(", ");
  const updateSet = columns
    .filter((c) => c !== pk)
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");

  await db.execute(
    `INSERT INTO ${table} (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT(${pk}) DO UPDATE SET ${updateSet}`,
    values,
  );
}

// ---------------------------------------------------------------------------
// Remote file helpers
// ---------------------------------------------------------------------------

async function listRemoteDeviceFiles(
  backend: ISyncBackend,
): Promise<{ deviceId: string; path: string }[]> {
  try {
    const files = await backend.listDir(SYNC_DIR);
    return files
      .filter((f) => !f.isDirectory && f.name.startsWith("device-") && f.name.endsWith(".json"))
      .map((f) => ({
        deviceId: f.name.replace(/^device-/, "").replace(/\.json$/, ""),
        path: `${SYNC_DIR}/${f.name}`,
      }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main sync entry point
// ---------------------------------------------------------------------------

export async function runSimpleSync(
  backend: ISyncBackend,
  onProgress?: (message: string) => void,
): Promise<{ success: boolean; changes: number; error?: string }> {
  try {
    onProgress?.("准备同步...");

    const lastSync = await getLastSyncTimestamp();
    const localDeviceId = await getDeviceId();
    const now = Date.now();

    // 1. Ensure remote sync directory exists
    try {
      await backend.ensureDirectories();
    } catch {
      // Directory may already exist
    }

    // 2. Pull and apply all other devices' changesets
    onProgress?.("获取其他设备的变更...");
    const remoteFiles = await listRemoteDeviceFiles(backend);

    let totalApplied = 0;
    for (const { deviceId, path } of remoteFiles) {
      // Skip our own file
      if (deviceId === localDeviceId) continue;

      try {
        const payload = await backend.getJSON<DeviceSyncPayload>(path);
        if (!payload) continue;

        // Only apply changes newer than our last sync
        // (avoids re-applying already-seen changes on every sync)
        if (payload.timestamp <= lastSync) {
          onProgress?.(`跳过设备 ${deviceId.slice(0, 8)}（无新变更）`);
          continue;
        }

        onProgress?.(`应用设备 ${deviceId.slice(0, 8)} 的变更...`);
        const result = await applyChanges(payload);
        totalApplied += result.applied;
      } catch (e) {
        // Non-fatal: skip this device's file and continue
        console.warn(`[SimpleSync] Failed to apply changes from device ${deviceId}:`, e);
      }
    }

    // 3. Collect and push local changes
    onProgress?.("收集本地变更...");
    const localPayload = await collectChanges(lastSync);

    const changeCount = Object.values(localPayload.tables).reduce(
      (sum, t) => sum + t.records.length + t.deletedIds.length,
      0,
    );

    if (changeCount > 0) {
      onProgress?.(`上传 ${changeCount} 条变更...`);
      await backend.putJSON(deviceSyncPath(localDeviceId), localPayload);
    } else {
      // Still write our file to update the timestamp so other devices know we're current
      // (only if we haven't written recently — avoid unnecessary writes)
      const existing = await backend.getJSON<DeviceSyncPayload>(
        deviceSyncPath(localDeviceId),
      ).catch(() => null);
      if (!existing || now - existing.timestamp > 5 * 60 * 1000) {
        await backend.putJSON(deviceSyncPath(localDeviceId), localPayload);
      }
    }

    // 4. Update last sync timestamp
    await setLastSyncTimestamp(now);

    onProgress?.("同步完成");
    return { success: true, changes: changeCount + totalApplied };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[SimpleSync] Sync failed:", error);
    return { success: false, changes: 0, error };
  }
}
