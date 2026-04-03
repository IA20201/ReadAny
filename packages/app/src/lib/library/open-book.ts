import { useAppStore } from "@/stores/app-store";
import { useLibraryStore } from "@/stores/library-store";
import { getPlatformService } from "@readany/core/services";
import { setBookSyncStatus } from "@readany/core/db/database";
import { downloadBookFile } from "@readany/core/sync";
import { createSyncBackend } from "@readany/core/sync/sync-backend-factory";
import { useSyncStore } from "@readany/core/stores/sync-store";
import type { Book } from "@readany/core/types";
import type { TFunction } from "i18next";
import { toast } from "sonner";

interface OpenDesktopBookOptions {
  book: Book;
  t: TFunction;
  initialCfi?: string;
}

const pendingDownloads = new Set<string>();

function openReaderTab(book: Book, initialCfi?: string) {
  const { addTab, setActiveTab } = useAppStore.getState();
  const tabId = `reader-${book.id}`;
  addTab({
    id: tabId,
    type: "reader",
    title: book.meta.title,
    bookId: book.id,
    initialCfi,
  });
  setActiveTab(tabId);
}

export async function openDesktopBook({
  book,
  t,
  initialCfi,
}: OpenDesktopBookOptions): Promise<boolean> {
  const { books, setBooks, loadBooks } = useLibraryStore.getState();

  if (pendingDownloads.has(book.id) || book.syncStatus === "downloading") {
    return false;
  }

  if (book.syncStatus === "remote") {
    const syncStore = useSyncStore.getState();
    if (!syncStore.config) {
      toast.error(t("settings.syncNotConfigured"));
      return false;
    }

    const platform = getPlatformService();
    const secretKey =
      syncStore.config.type === "webdav" ? "sync_webdav_password" : "sync_s3_secret_key";
    const password = await platform.kvGetItem(secretKey);
    if (!password) {
      toast.error(t("library.passwordNotFound", "未找到同步密码，请重新配置"));
      return false;
    }

    pendingDownloads.add(book.id);
    setBooks(
      books.map((item) => (item.id === book.id ? { ...item, syncStatus: "downloading" } : item)),
    );
    await setBookSyncStatus(book.id, "downloading");

    try {
      const backend = createSyncBackend(syncStore.config, password);
      const success = await downloadBookFile(backend, book.id, book.filePath);
      await loadBooks();

      if (!success) {
        toast.error(t("library.downloadFailed", "下载失败，请重试"));
        return false;
      }
    } catch (error) {
      console.error("[openDesktopBook] Failed to download remote book:", error);
      await setBookSyncStatus(book.id, "remote");
      await loadBooks();
      toast.error(t("library.downloadFailed", "下载失败，请重试"));
      return false;
    } finally {
      pendingDownloads.delete(book.id);
    }
  }

  openReaderTab(book, initialCfi);
  return true;
}
