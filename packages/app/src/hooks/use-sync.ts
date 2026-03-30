/**
 * Desktop auto-sync hook — thin wrapper around the shared core hook.
 * Passes loadBooks as the onSyncComplete callback.
 */
import { useLibraryStore } from "@/stores/library-store";
import { useAutoSync as useAutoSyncCore } from "@readany/core/hooks/use-auto-sync";

export function useAutoSync() {
  const loadBooks = useLibraryStore((s) => s.loadBooks);
  useAutoSyncCore(loadBooks);
}
