import { getBooks, initDatabase } from "@readany/core/db/database";

const STORAGE_KEY = "readany-desktop-library-root";

function normalizeDir(path: string): string {
  const trimmed = path.replace(/^file:\/\//, "").trim();
  if (!trimmed) return "";
  if (/^[A-Za-z]:\\$/.test(trimmed)) return trimmed;
  return trimmed.replace(/[\\/]+$/, "");
}

function isManagedLibraryRelativePath(path: string): boolean {
  return path.startsWith("books/") || path.startsWith("covers/");
}

function readStoredRoot(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const normalized = normalizeDir(raw);
  return normalized || null;
}

async function joinWithinRoot(root: string, relativePath: string): Promise<string> {
  const { join } = await import("@tauri-apps/api/path");
  return join(root, relativePath);
}

export async function getDefaultDesktopLibraryRoot(): Promise<string> {
  const { appDataDir } = await import("@tauri-apps/api/path");
  return normalizeDir(await appDataDir());
}

export async function getDesktopLibraryRoot(): Promise<string> {
  return readStoredRoot() ?? (await getDefaultDesktopLibraryRoot());
}

export async function setDesktopLibraryRoot(path: string | null): Promise<void> {
  if (typeof window === "undefined") return;

  const normalized = path ? normalizeDir(path) : "";
  const defaultRoot = await getDefaultDesktopLibraryRoot();

  if (!normalized || normalized === defaultRoot) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, normalized);
}

export async function clearDesktopLibraryRoot(): Promise<void> {
  await setDesktopLibraryRoot(null);
}

export async function resolveDesktopDataPath(path: string): Promise<string> {
  if (!path) return "";
  if (
    path.startsWith("/") ||
    path.startsWith("file://") ||
    path.startsWith("asset://") ||
    path.startsWith("http")
  ) {
    return path;
  }

  if (isManagedLibraryRelativePath(path)) {
    return joinWithinRoot(await getDesktopLibraryRoot(), path);
  }

  return joinWithinRoot(await getDefaultDesktopLibraryRoot(), path);
}

async function ensureManagedSubDirs(root: string): Promise<void> {
  const { mkdir } = await import("@tauri-apps/plugin-fs");
  await mkdir(await joinWithinRoot(root, "books"), { recursive: true });
  await mkdir(await joinWithinRoot(root, "covers"), { recursive: true });
}

type MigrationResult = {
  from: string;
  to: string;
  movedFiles: number;
  skippedFiles: number;
};

export async function migrateDesktopLibraryRoot(nextRoot: string): Promise<MigrationResult> {
  const { copyFile, exists, remove } = await import("@tauri-apps/plugin-fs");

  const targetRoot = normalizeDir(nextRoot);
  if (!targetRoot) {
    throw new Error("Invalid target directory");
  }

  const currentRoot = await getDesktopLibraryRoot();
  if (currentRoot === targetRoot) {
    return { from: currentRoot, to: targetRoot, movedFiles: 0, skippedFiles: 0 };
  }

  await ensureManagedSubDirs(targetRoot);
  await initDatabase();
  const books = await getBooks();

  const relativePaths = Array.from(
    new Set(
      books.flatMap((book) => {
        const paths: string[] = [];
        if (isManagedLibraryRelativePath(book.filePath)) paths.push(book.filePath);
        if (book.meta.coverUrl && isManagedLibraryRelativePath(book.meta.coverUrl)) {
          paths.push(book.meta.coverUrl);
        }
        return paths;
      }),
    ),
  );

  const copiedSources: string[] = [];
  let movedFiles = 0;
  let skippedFiles = 0;

  for (const relativePath of relativePaths) {
    const sourcePath = await joinWithinRoot(currentRoot, relativePath);
    const targetPath = await joinWithinRoot(targetRoot, relativePath);

    if (sourcePath === targetPath) {
      skippedFiles += 1;
      continue;
    }

    if (!(await exists(sourcePath))) {
      skippedFiles += 1;
      continue;
    }

    if (await exists(targetPath)) {
      await remove(targetPath);
    }

    await copyFile(sourcePath, targetPath);
    copiedSources.push(sourcePath);
    movedFiles += 1;
  }

  for (const sourcePath of copiedSources) {
    try {
      await remove(sourcePath);
    } catch {
      // If a file is currently in use, keep the copied target and leave cleanup to the user.
    }
  }

  await setDesktopLibraryRoot(targetRoot);

  return {
    from: currentRoot,
    to: targetRoot,
    movedFiles,
    skippedFiles,
  };
}

export async function resetDesktopLibraryRoot(): Promise<MigrationResult> {
  return migrateDesktopLibraryRoot(await getDefaultDesktopLibraryRoot());
}
